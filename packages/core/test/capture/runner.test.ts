import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { decodePng } from '@diffra/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserPool } from '../../src/capture/browser-pool.js';
import { captureTargets } from '../../src/capture/screenshot-runner.js';
import type { VisualTarget } from '../../src/types/index.js';
import { normalizeViewport } from '../../src/utils/viewport.js';

describe('capture runner', () => {
  describe('Capture Runner Timeout & HTTP Error Resilience', () => {
    it('handles HTTP error responses (404, 500) gracefully without unhandled exceptions', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Custom mock driver to verify non-browser routing
      const mockDriver = {
        name: 'mock',
        capture: vi.fn().mockImplementation(async () => {
          return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        }),
      };

      const targetObj: VisualTarget = {
        id: 'mock-target',
        name: 'Mock',
        group: 'MockGroup',
        url: 'https://mock.domain/404',
      };

      const results = await captureTargets(
        [
          {
            target: targetObj,
            viewport: { width: 800, height: 600 },
            driver: mockDriver,
          },
        ],
        'https://mock.domain',
      );

      expect(results).toHaveLength(1);
      expect(mockDriver.capture).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it('catches custom driver capture exceptions without crashing the runner', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const failingDriver = {
        name: 'failing',
        capture: vi
          .fn()
          .mockRejectedValue(new Error('Connection timed out after 30000ms')),
      };

      const results = await captureTargets([
        {
          target: { id: 'fail-target', name: 'Fail', group: 'FailGroup' },
          viewport: { width: 800, height: 600 },
          driver: failingDriver,
        },
      ]);

      expect(results).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Driver failing capture failed for fail-target: Connection timed out',
        ),
      );
      warnSpy.mockRestore();
    });

    it('catches custom driver captureAll exceptions without crashing the runner', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const failingBatchDriver = {
        name: 'failing-batch',
        captureAll: vi
          .fn()
          .mockRejectedValue(new Error('Gateway Timeout (504)')),
      };

      const results = await captureTargets([
        {
          target: { id: 'fail-batch-1', name: 'Fail1', group: 'FailGroup' },
          viewport: { width: 800, height: 600 },
          driver: failingBatchDriver,
        },
      ]);

      expect(results).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Driver failing-batch captureAll failed: Gateway Timeout (504)',
        ),
      );
      warnSpy.mockRestore();
    });
  });

  describe('Playwright Browser Task Runner', () => {
    let server: http.Server;
    let serverUrl: string;

    beforeEach(async () => {
      // Dynamic port 0 server serving minimal deterministic test HTML
      server = http.createServer((req, res) => {
        if (req.url === '/slow') {
          setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(
              '<html><body><div id="target">Slow Content</div></body></html>',
            );
          }, 100);
          return;
        }

        if (req.url === '/error-500') {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { margin: 0; background-color: #f4f4f5; }
                .box { width: 100px; height: 100px; background-color: #2563eb; }
              </style>
            </head>
            <body>
              <div id="target" class="box">Active Target</div>
            </body>
          </html>
        `);
      });

      await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
      });

      const addr = server.address() as AddressInfo;
      const host = addr.family === 'IPv6' ? `[${addr.address}]` : addr.address;
      serverUrl = `http://${host}:${addr.port}`;
    });

    afterEach(async () => {
      if (server) {
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
      }
    });

    it('handles concurrency scaling (1 vs 4 vs 8) and drains queue completely', async () => {
      const taskCount = 8;
      const tasks = Array.from({ length: taskCount }, (_, i) => ({
        target: {
          id: `concurrency-task-${i}`,
          name: `Task ${i}`,
          group: 'ConcurrencyGroup',
          url: `${serverUrl}/?item=${i}`,
        },
        viewport: { width: 400, height: 300 },
      }));

      // Test with concurrency = 1 (serial)
      const serialResults = await captureTargets(tasks.slice(0, 2), undefined, {
        concurrency: 1,
      });
      expect(serialResults).toHaveLength(2);
      for (const res of serialResults) {
        expect(res.buffer).toBeInstanceOf(Buffer);
        expect(res.buffer.length).toBeGreaterThan(0);
        const decoded = decodePng(res.buffer);
        expect(decoded.width).toBe(400);
        expect(decoded.height).toBe(300);
      }

      // Test with concurrency = 4
      const parallelResults = await captureTargets(
        tasks.slice(0, 4),
        undefined,
        {
          concurrency: 4,
        },
      );
      expect(parallelResults).toHaveLength(4);

      // Test with concurrency > tasks length (concurrency 16 on 3 tasks)
      const overAllocatedResults = await captureTargets(
        tasks.slice(0, 3),
        undefined,
        { concurrency: 16 },
      );
      expect(overAllocatedResults).toHaveLength(3);

      // Test with zero or negative concurrency option (must safely default to >= 1)
      const zeroConcurrencyResults = await captureTargets(
        tasks.slice(0, 2),
        undefined,
        { concurrency: 0 },
      );
      expect(zeroConcurrencyResults).toHaveLength(2);
    });

    it('recovers from browser navigation failures and malformed URLs gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const failingTasks = [
        {
          target: {
            id: 'invalid-url-target',
            name: 'InvalidUrl',
            group: 'Failures',
            url: 'not-a-valid-url-format',
          },
          viewport: { width: 320, height: 240 },
        },
        {
          target: {
            id: 'missing-url-target',
            name: 'MissingUrl',
            group: 'Failures',
            // No url, and no baseUrl provided -> throws error caught by runner
          },
          viewport: { width: 320, height: 240 },
        },
        {
          target: {
            id: 'healthy-endpoint',
            name: 'Healthy',
            group: 'Failures',
            url: `${serverUrl}/healthy`,
          },
          viewport: { width: 320, height: 240 },
        },
      ];

      const results = await captureTargets(failingTasks, undefined, {
        concurrency: 2,
      });

      // The healthy target should succeed despite errors in adjacent tasks
      expect(results).toHaveLength(1);
      const healthyResult = results.find(
        (r) => r.target.id === 'healthy-endpoint',
      );
      expect(healthyResult).toBeDefined();

      // Warning logs should capture the failures without unhandled process rejection
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[diffra] Warning capturing invalid-url-target',
        ),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[diffra] Warning capturing missing-url-target',
        ),
      );

      warnSpy.mockRestore();
    });

    it('safely handles BrowserPool releasePage and close when already closed or crashed', async () => {
      const pool = new BrowserPool(2, true);

      // Acquire page
      const workerPage = await pool.acquirePage({ width: 640, height: 480 });
      expect(workerPage.page).toBeDefined();
      expect(workerPage.context).toBeDefined();

      // Manually close page and context before releasePage
      await workerPage.page.close();
      await workerPage.context.close();

      // releasePage should not throw when called on closed page/context
      await expect(pool.releasePage(workerPage)).resolves.not.toThrow();

      // Close pool
      await expect(pool.close()).resolves.not.toThrow();

      // Re-closing an already closed pool must be idempotent and safe
      await expect(pool.close()).resolves.not.toThrow();
    });

    it('handles extreme viewport boundaries and numeric inputs', async () => {
      // 1. Extreme 1x1 minimal viewport
      const minimalVp = normalizeViewport({ width: 1, height: 1 });
      expect(minimalVp.width).toBe(1);
      expect(minimalVp.height).toBe(1);

      // 2. High-res 4K viewport
      const largeVp = normalizeViewport({
        width: 3840,
        height: 2160,
        name: '4k',
      });
      expect(largeVp.width).toBe(3840);
      expect(largeVp.height).toBe(2160);
      expect(largeVp.name).toBe('4k');

      // 3. Numeric shorthand input (e.g. 1440) -> defaults height to 800
      const numericVp = normalizeViewport(1440);
      expect(numericVp.width).toBe(1440);
      expect(numericVp.height).toBe(800);
      expect(numericVp.name).toBe('1440px');

      // 4. Viewport with missing height -> defaults height to 800
      const missingHeightVp = normalizeViewport({ width: 768 } as unknown as {
        width: number;
        height: number;
      });
      expect(missingHeightVp.width).toBe(768);
      expect(missingHeightVp.height).toBe(800);

      // 5. Capture targets across minimal and high-res viewports
      const extremeTasks = [
        {
          target: {
            id: 'viewport-minimal',
            name: 'Minimal',
            group: 'Viewports',
            url: `${serverUrl}/`,
          },
          viewport: { width: 10, height: 10 },
        },
        {
          target: {
            id: 'viewport-large',
            name: 'Large',
            group: 'Viewports',
            url: `${serverUrl}/`,
          },
          viewport: { width: 1600, height: 900 },
        },
      ];

      const results = await captureTargets(extremeTasks, undefined, {
        concurrency: 2,
      });

      expect(results).toHaveLength(2);
      const minCap = results.find((r) => r.target.id === 'viewport-minimal');
      const maxCap = results.find((r) => r.target.id === 'viewport-large');

      expect(minCap).toBeDefined();
      expect(maxCap).toBeDefined();

      if (minCap && maxCap) {
        const decodedMin = decodePng(minCap.buffer);
        const decodedMax = decodePng(maxCap.buffer);
        expect(decodedMin.width).toBe(10);
        expect(decodedMin.height).toBe(10);
        expect(decodedMax.width).toBe(1600);
        expect(decodedMax.height).toBe(900);
      }
    });

    it('handles non-existent target selector with timeout fallback without hanging', async () => {
      const taskWithBadSelector = [
        {
          target: {
            id: 'target-bad-selector',
            name: 'BadSelector',
            group: 'Selectors',
            url: `${serverUrl}/`,
            snapshot: {
              selector: '#non-existent-selector-999',
            },
          },
          viewport: { width: 300, height: 200 },
        },
      ];

      // Runner should gracefully fall back to full page screenshot when selector is not found
      const results = await captureTargets(taskWithBadSelector, undefined, {
        concurrency: 1,
      });

      expect(results).toHaveLength(1);
      const [first] = results;
      if (!first) throw new Error('expected one capture');
      const decoded = decodePng(first.buffer);
      expect(decoded.width).toBe(300);
      expect(decoded.height).toBe(200);
    }, 15000);
  });
});
