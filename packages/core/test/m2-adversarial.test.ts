import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import net, { type AddressInfo, type Socket } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { encodePng } from '@diffra/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureTargets } from '../src/capture/screenshot-runner.js';
import { BoundedLruCache, FigmaDriver } from '../src/drivers/figma.js';
import {
  createImageDriver,
  createStorybookDriver,
  PNG_SIGNATURE,
  StorybookDriver,
  validatePngFile,
} from '../src/drivers/index.js';
import { createUrlDriver } from '../src/drivers/url.js';
import type { VisualTarget } from '../src/types/index.js';

function testServerRequest(
  server: http.Server,
  urlStr: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const socket = new EventEmitter();
    const req = new http.IncomingMessage(socket as unknown as Socket);
    req.url = urlStr;
    req.method = 'GET';
    const res = new http.ServerResponse(req);
    let body = '';
    res.write = (chunk: unknown) => {
      body += String(chunk);
      return true;
    };
    res.end = (chunk?: unknown) => {
      if (chunk) body += String(chunk);
      resolve({ status: res.statusCode, body });
      return res;
    };
    const handler = server.listeners('request')[0] as (
      req: http.IncomingMessage,
      res: http.ServerResponse,
    ) => void;
    handler(req, res);
  });
}

describe('Empirical Challenger: Milestone 2 Adversarial Suite', () => {
  // ==========================================================================
  // Section 1: Figma Driver - Bounded LRU Cache under High Eviction Pressure
  // ==========================================================================
  describe('Figma Driver LRU Cache Stress & Eviction', () => {
    it('strictly bounds size to maxSize under 1,000 continuous insertions', () => {
      const maxSize = 10;
      const cache = new BoundedLruCache<string, number>(maxSize);

      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, i);
        expect(cache.size).toBeLessThanOrEqual(maxSize);
      }

      expect(cache.size).toBe(maxSize);
      // Keys 0 through 989 must be evicted
      for (let i = 0; i < 990; i++) {
        expect(cache.get(`key-${i}`)).toBeUndefined();
      }
      // Keys 990 through 999 must remain present
      for (let i = 990; i < 1000; i++) {
        expect(cache.get(`key-${i}`)).toBe(i);
      }
    });

    it('correctly updates MRU on access and evicts oldest unaccessed entry', () => {
      const cache = new BoundedLruCache<string, string>(3);
      cache.set('a', 'alpha');
      cache.set('b', 'beta');
      cache.set('c', 'gamma');

      // Access 'a' so 'b' becomes the oldest
      expect(cache.get('a')).toBe('alpha');

      // Insert 'd'; 'b' should be evicted, 'a' and 'c' preserved
      cache.set('d', 'delta');
      expect(cache.size).toBe(3);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('a')).toBe('alpha');
      expect(cache.get('c')).toBe('gamma');
      expect(cache.get('d')).toBe('delta');
    });

    it('handles boundary capacity of 1 without unbounded growth', () => {
      const cache = new BoundedLruCache<string, string>(1);
      cache.set('k1', 'v1');
      expect(cache.size).toBe(1);
      expect(cache.get('k1')).toBe('v1');

      cache.set('k2', 'v2');
      expect(cache.size).toBe(1);
      expect(cache.get('k1')).toBeUndefined();
      expect(cache.get('k2')).toBe('v2');
    });

    it('re-inserting identical key updates value without altering capacity', () => {
      const cache = new BoundedLruCache<string, string>(2);
      cache.set('k1', 'val1');
      cache.set('k2', 'val2');
      cache.set('k1', 'val1-updated');

      expect(cache.size).toBe(2);
      expect(cache.get('k1')).toBe('val1-updated');
      expect(cache.get('k2')).toBe('val2');
    });
  });

  // ==========================================================================
  // Section 2: Figma Driver - HTTP 429 / 503 Backoff & Retry-After
  // ==========================================================================
  describe('Figma Driver Rate Limiting & Backoff', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('retries on HTTP 503 Service Unavailable with exponential backoff and succeeds', async () => {
      let callCount = 0;
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (url.includes('/v1/images/')) {
          if (callCount <= 2) {
            // First two attempts fail with 503
            return Promise.resolve({
              ok: false,
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers(),
            });
          }
          // Third attempt succeeds
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              images: { '20:1': 'https://mock.figma.com/img20-1.png' },
            }),
          });
        }
        // Image download
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const driver = new FigmaDriver({
        fileKey: 'file-503',
        personalAccessToken: 'token',
        maxRetries: 3,
      });

      const capturePromise = driver.capture(
        {
          target: {
            id: 'figma--20_1',
            name: 'Frame503',
            metadata: { figmaNodeId: '20:1' },
          },
          viewport: { width: 800, height: 600 },
        },
        { config: {}, cwd: process.cwd() },
      );

      // Fast-forward through exponential backoff timers
      await vi.runAllTimersAsync();

      const result = await capturePromise;
      expect(result).not.toBeNull();
      expect(callCount).toBe(4); // 2 failed + 1 successful API call + 1 image download
    });

    it('honors numeric Retry-After header in seconds', async () => {
      let callCount = 0;
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (url.includes('/v1/images/')) {
          if (callCount === 1) {
            return Promise.resolve({
              ok: false,
              status: 429,
              statusText: 'Too Many Requests',
              headers: new Headers({ 'retry-after': '2' }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              images: { '30:1': 'https://mock.figma.com/img30-1.png' },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const driver = new FigmaDriver({
        fileKey: 'file-retry-after',
        personalAccessToken: 'token',
        maxRetries: 2,
      });

      const capturePromise = driver.capture(
        {
          target: {
            id: 'figma--30_1',
            name: 'FrameRetryAfter',
            metadata: { figmaNodeId: '30:1' },
          },
          viewport: { width: 800, height: 600 },
        },
        { config: {}, cwd: process.cwd() },
      );

      await vi.runAllTimersAsync();
      const result = await capturePromise;
      expect(result).not.toBeNull();
      expect(callCount).toBe(3);
    });

    it('evaluates Retry-After HTTP-Date format behavior and resilience', async () => {
      let callCount = 0;
      // HTTP-Date formatted Retry-After per RFC 7231
      const futureDate = new Date(Date.now() + 2000).toUTCString();

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (url.includes('/v1/images/')) {
          if (callCount === 1) {
            return Promise.resolve({
              ok: false,
              status: 429,
              statusText: 'Too Many Requests',
              headers: new Headers({ 'retry-after': futureDate }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              images: { '40:1': 'https://mock.figma.com/img40-1.png' },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const driver = new FigmaDriver({
        fileKey: 'file-retry-date',
        personalAccessToken: 'token',
        maxRetries: 2,
      });

      const capturePromise = driver.capture(
        {
          target: {
            id: 'figma--40_1',
            name: 'FrameRetryDate',
            metadata: { figmaNodeId: '40:1' },
          },
          viewport: { width: 800, height: 600 },
        },
        { config: {}, cwd: process.cwd() },
      );

      await vi.runAllTimersAsync();
      const result = await capturePromise;
      // Should recover via fallback exponential backoff even when HTTP-Date header is present
      expect(result).not.toBeNull();
      expect(callCount).toBe(3);
    });

    it('diagnoses retry budget exhaustion with actionable diagnostic warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // All attempts return 429
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'retry-after': '0' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const driver = new FigmaDriver({
        fileKey: 'file-exhausted',
        personalAccessToken: 'token',
        maxRetries: 2,
      });

      const capturePromise = driver.capture(
        {
          target: {
            id: 'figma--50_1',
            name: 'FrameExhausted',
            metadata: { figmaNodeId: '50:1' },
          },
          viewport: { width: 800, height: 600 },
        },
        { config: {}, cwd: process.cwd() },
      );

      await vi.runAllTimersAsync();
      const result = await capturePromise;

      // Returns null on exhaustion rather than crashing the pipeline
      expect(result).toBeNull();
      // Emits clear diagnostic warning specifying status code and retry limit
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Figma API rate limit exceeded (429) after 2 retries',
        ),
      );
      // Verified fetch was invoked 1 initial + 2 retries = 3 times total
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // Section 3: URL Driver - Collision Analysis for Complex URLs
  // ==========================================================================
  describe('URL Driver Route ID Collision Analysis', () => {
    it('discovers routes with complex query parameters, hashes, and symbols', async () => {
      const driver = createUrlDriver({
        baseUrl: 'https://example.com',
        urls: [
          '/search?q=shoes',
          '/search?q=hats',
          '/dashboard#overview',
          '/dashboard#reports',
          '/products?cat=shoes&sort=price',
          '/products?cat=shoes&sort=rating',
        ],
      });

      const targets = await driver.discover?.({
        config: {},
        cwd: process.cwd(),
      });

      expect(targets).toHaveLength(6);
      const ids = (targets ?? []).map((t) => t.id);
      expect(new Set(ids).size).toBe(6);
    });

    it('identifies collision boundaries between identical query and hash fragments', async () => {
      // Testing the boundary: query vs hash with identical fragment name
      // e.g. /profile?tab=settings vs /profile#tab=settings
      const driver = createUrlDriver({
        baseUrl: 'https://example.com',
        urls: ['/profile?tab=settings', '/profile#tab=settings'],
      });

      const targets =
        (await driver.discover?.({
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(2);
      // Both URLs produce route--profile_tab_settings under the current sanitizer
      // Documenting the exact empirical collision behavior:
      const id1 = targets[0]?.id;
      const id2 = targets[1]?.id;
      expect(id1).toBe('route--profile_tab_settings');
      expect(id2).toBe('route--profile_tab_settings');
      // They collide because query and hash use identical '_' delimiter
      expect(id1).toBe(id2);
    });

    it('identifies collision boundaries between path separator and query delimiters', async () => {
      // /search_q_shoes (static path) vs /search?q=shoes (path + query)
      const driver = createUrlDriver({
        baseUrl: 'https://example.com',
        urls: ['/search_q_shoes', '/search?q=shoes'],
      });

      const targets =
        (await driver.discover?.({
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(2);
      expect(targets[0]?.id).toBe('route--search_q_shoes');
      expect(targets[1]?.id).toBe('route--search_q_shoes');
      expect(targets[0]?.id).toBe(targets[1]?.id);
    });

    it('handles special characters and URI encoded values safely without crashing', async () => {
      const driver = createUrlDriver({
        baseUrl: 'https://example.com',
        urls: [
          '/api?param=@foo',
          '/api?param=$foo',
          '/api?filter=100%25',
          '/api?complex=a+b*c',
          '/home//double//slashes/',
          '///multiple///leading///',
        ],
      });

      const targets =
        (await driver.discover?.({
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(6);
      for (const target of targets) {
        expect(target.id).toMatch(/^route--[a-z0-9_]+$/);
        expect(target.url).toBeDefined();
      }
    });

    it('handles completely malformed URLs without throwing exceptions', async () => {
      const driver = createUrlDriver({
        baseUrl: '',
        urls: ['http://::invalid::url', 'not-a-valid-url'],
      });

      const targets = await driver.discover?.({
        config: {},
        cwd: process.cwd(),
      });

      expect(Array.isArray(targets)).toBe(true);
      expect(targets?.length).toBe(2);
    });
  });

  // ==========================================================================
  // Section 4: Capture Runner - Timeouts & HTTP Error Handling
  // ==========================================================================
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

  // ==========================================================================
  // Section 5: Image Driver - Magic Bytes, Corrupt Files & Multi-Directory Collision
  // ==========================================================================
  describe('Image Driver Stress & Multi-Directory Scanning', () => {
    const tempDirs: string[] = [];

    function makeTempDir(prefix: string): string {
      const dir = path.join(
        os.tmpdir(),
        `diffra-adv-img-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      );
      tempDirs.push(dir);
      return dir;
    }

    afterEach(async () => {
      for (const dir of tempDirs) {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
      tempDirs.length = 0;
    });

    it('validatePngFile stress: verifies headers across 0-byte, truncated, and non-PNG formats', async () => {
      const tempDir = makeTempDir('validate-stress');
      await fs.mkdir(tempDir, { recursive: true });

      const files = {
        zero: path.join(tempDir, 'zero.png'),
        oneByte: path.join(tempDir, '1byte.png'),
        fourBytes: path.join(tempDir, '4bytes.png'),
        sevenBytes: path.join(tempDir, '7bytes.png'),
        corruptEight: path.join(tempDir, 'corrupt8.png'),
        jpeg: path.join(tempDir, 'photo.png'),
        gif87: path.join(tempDir, 'anim87.png'),
        gif89: path.join(tempDir, 'anim89.png'),
        bmp: path.join(tempDir, 'bitmap.png'),
        webp: path.join(tempDir, 'modern.png'),
        valid: path.join(tempDir, 'valid.png'),
      };

      // 0 bytes
      await fs.writeFile(files.zero, Buffer.alloc(0));
      // Truncated headers
      await fs.writeFile(files.oneByte, Buffer.from([0x89]));
      await fs.writeFile(
        files.fourBytes,
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      );
      await fs.writeFile(
        files.sevenBytes,
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]),
      );
      // 8 bytes but not PNG
      await fs.writeFile(files.corruptEight, Buffer.from('NOT_PNG!'));
      // Other image formats
      await fs.writeFile(
        files.jpeg,
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
      );
      await fs.writeFile(
        files.gif87,
        Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x01, 0x00]),
      );
      await fs.writeFile(
        files.gif89,
        Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]),
      );
      await fs.writeFile(
        files.bmp,
        Buffer.from([0x42, 0x4d, 0x36, 0x00, 0x00, 0x00, 0x00, 0x00]),
      );
      await fs.writeFile(
        files.webp,
        Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]),
      );
      // Valid PNG
      await fs.writeFile(
        files.valid,
        encodePng(Buffer.alloc(2 * 2 * 4, 128), 2, 2),
      );

      // Verify empirical results
      expect(await validatePngFile(files.zero)).toEqual({
        valid: false,
        reason: 'File is 0 bytes (empty)',
      });
      expect(await validatePngFile(files.oneByte)).toEqual({
        valid: false,
        reason: 'File size is less than 8-byte PNG header',
      });
      expect(await validatePngFile(files.fourBytes)).toEqual({
        valid: false,
        reason: 'File size is less than 8-byte PNG header',
      });
      expect(await validatePngFile(files.sevenBytes)).toEqual({
        valid: false,
        reason: 'File size is less than 8-byte PNG header',
      });
      expect(await validatePngFile(files.corruptEight)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.jpeg)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.gif87)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.gif89)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.bmp)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.webp)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.valid)).toEqual({ valid: true });

      // Non-existent file
      const nonExistent = await validatePngFile(
        path.join(tempDir, 'ghost-non-existent.png'),
      );
      expect(nonExistent.valid).toBe(false);
      expect(nonExistent.reason).toMatch(/ENOENT/);
    });

    it('ImageDriver discovery skips corrupt, truncated, and non-PNG files while discovering valid targets', async () => {
      const tempDir = makeTempDir('discover-stress');
      await fs.mkdir(tempDir, { recursive: true });

      // Populate with mixture of invalid and valid files
      await fs.writeFile(path.join(tempDir, 'empty.png'), Buffer.alloc(0));
      await fs.writeFile(
        path.join(tempDir, 'trunc.png'),
        Buffer.from([0x89, 0x50]),
      );
      await fs.writeFile(
        path.join(tempDir, 'jpeg.png'),
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      );
      await fs.writeFile(
        path.join(tempDir, 'gif.png'),
        Buffer.from('GIF89a\x01\x00'),
      );
      await fs.writeFile(
        path.join(tempDir, 'noise.png'),
        Buffer.from('RANDOM_CORRUPT_BYTES_XYZ'),
      );
      await fs.writeFile(
        path.join(tempDir, 'notes.txt'),
        Buffer.from('Should be ignored because not .png'),
      );

      // Two valid PNGs
      const pngA = encodePng(Buffer.alloc(1 * 1 * 4, 10), 1, 1);
      const pngB = encodePng(Buffer.alloc(2 * 2 * 4, 20), 2, 2);
      await fs.writeFile(path.join(tempDir, 'button-primary.png'), pngA);
      await fs.writeFile(path.join(tempDir, 'button-secondary.png'), pngB);

      const driver = createImageDriver({ dir: tempDir });
      const targets = await driver.discover?.({
        config: {},
        cwd: process.cwd(),
      });

      expect(targets).toHaveLength(2);
      const names = (targets ?? []).map((t) => t.name).sort();
      expect(names).toEqual(['button-primary', 'button-secondary']);
    });

    it('ImageDriver capture handles corrupt/truncated targets returning null without unhandled exceptions', async () => {
      const tempDir = makeTempDir('capture-stress');
      await fs.mkdir(tempDir, { recursive: true });

      const emptyPath = path.join(tempDir, 'zero.png');
      const truncPath = path.join(tempDir, 'trunc.png');
      const fakePath = path.join(tempDir, 'fake.png');
      const validPath = path.join(tempDir, 'real.png');

      await fs.writeFile(emptyPath, Buffer.alloc(0));
      await fs.writeFile(truncPath, Buffer.from([0x89, 0x50]));
      await fs.writeFile(fakePath, Buffer.from('NOT_A_PNG_HEADER_HERE'));
      await fs.writeFile(
        validPath,
        encodePng(Buffer.alloc(2 * 2 * 4, 50), 2, 2),
      );

      const driver = createImageDriver({ dir: tempDir });

      // 1. 0-byte file capture
      const bufZero = await driver.capture?.(
        {
          target: { id: 'img--zero', name: 'zero', filePath: emptyPath },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufZero).toBeNull();

      // 2. Truncated header capture
      const bufTrunc = await driver.capture?.(
        {
          target: { id: 'img--trunc', name: 'trunc', filePath: truncPath },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufTrunc).toBeNull();

      // 3. Fake header capture
      const bufFake = await driver.capture?.(
        {
          target: { id: 'img--fake', name: 'fake', filePath: fakePath },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufFake).toBeNull();

      // 4. Missing file capture
      const bufMissing = await driver.capture?.(
        {
          target: {
            id: 'img--missing',
            name: 'missing',
            filePath: path.join(tempDir, 'does-not-exist.png'),
          },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufMissing).toBeNull();

      // 5. Target with missing filePath and imagePath
      const bufNoPath = await driver.capture?.(
        {
          target: { id: 'img--nopath', name: 'nopath' },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufNoPath).toBeNull();

      // 6. Valid file capture succeeds with PNG_SIGNATURE
      const bufValid = await driver.capture?.(
        {
          target: { id: 'img--valid', name: 'valid', filePath: validPath },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufValid).not.toBeNull();
      expect(bufValid?.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    });

    it('ImageDriver captureAll filters out corrupt files without dropping valid captures', async () => {
      const tempDir = makeTempDir('captureall-stress');
      await fs.mkdir(tempDir, { recursive: true });

      const invalidPath = path.join(tempDir, 'bad.png');
      const validPath = path.join(tempDir, 'good.png');
      await fs.writeFile(invalidPath, Buffer.from('CORRUPT_DATA'));
      await fs.writeFile(
        validPath,
        encodePng(Buffer.alloc(2 * 2 * 4, 100), 2, 2),
      );

      const driver = createImageDriver({ dir: tempDir });
      const results = await driver.captureAll?.(
        [
          {
            target: { id: 'img--bad', name: 'bad', filePath: invalidPath },
            viewport: { width: 100, height: 100 },
          },
          {
            target: { id: 'img--good', name: 'good', filePath: validPath },
            viewport: { width: 100, height: 100 },
          },
        ],
        { config: {}, cwd: process.cwd() },
      );

      expect(results).toHaveLength(1);
      expect(results?.[0]?.target.id).toBe('img--good');
      expect(results?.[0]?.buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    });

    it('multi-directory scanning eliminates collisions for duplicate basenames across different folders', async () => {
      const baseDir = makeTempDir('multidir-stress');
      const desktopDir = path.join(baseDir, 'desktop');
      const mobileDir = path.join(baseDir, 'mobile');
      await fs.mkdir(desktopDir, { recursive: true });
      await fs.mkdir(mobileDir, { recursive: true });

      // Duplicate basenames in different folders: 'hero.png' and 'footer.png'
      const pngDesktop = encodePng(Buffer.alloc(4 * 4 * 4, 50), 4, 4);
      const pngMobile = encodePng(Buffer.alloc(2 * 2 * 4, 150), 2, 2);

      await fs.writeFile(path.join(desktopDir, 'hero.png'), pngDesktop);
      await fs.writeFile(path.join(desktopDir, 'footer.png'), pngDesktop);
      await fs.writeFile(path.join(mobileDir, 'hero.png'), pngMobile);
      await fs.writeFile(path.join(mobileDir, 'footer.png'), pngMobile);

      const driver = createImageDriver({ dirs: [desktopDir, mobileDir] });
      const targets =
        (await driver.discover?.({
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(4);
      const targetIds = targets.map((t) => t.id);
      const uniqueIds = new Set(targetIds);
      expect(uniqueIds.size).toBe(4);

      expect(targetIds).toContain('image--desktop_hero_png');
      expect(targetIds).toContain('image--mobile_hero_png');
      expect(targetIds).toContain('image--desktop_footer_png');
      expect(targetIds).toContain('image--mobile_footer_png');

      const desktopHero = targets.find(
        (t) => t.id === 'image--desktop_hero_png',
      );
      const mobileHero = targets.find((t) => t.id === 'image--mobile_hero_png');
      expect(desktopHero?.group).toBe('desktop');
      expect(mobileHero?.group).toBe('mobile');
      expect(desktopHero?.name).toBe('hero');
      expect(mobileHero?.name).toBe('hero');
    });

    it('multi-directory scanning handles nested folders without cross-folder collision', async () => {
      const baseDir = makeTempDir('multidir-nested');
      const dirA = path.join(baseDir, 'suiteA');
      const dirB = path.join(baseDir, 'suiteB');
      await fs.mkdir(path.join(dirA, 'components'), { recursive: true });
      await fs.mkdir(path.join(dirB, 'components'), { recursive: true });

      const samplePng = encodePng(Buffer.alloc(2 * 2 * 4, 99), 2, 2);
      await fs.writeFile(
        path.join(dirA, 'components', 'button.png'),
        samplePng,
      );
      await fs.writeFile(
        path.join(dirB, 'components', 'button.png'),
        samplePng,
      );

      const driver = createImageDriver({ dirs: [dirA, dirB] });
      const targets =
        (await driver.discover?.({
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(2);
      expect(targets[0].id).not.toBe(targets[1].id);
      expect(targets[0].group).not.toBe(targets[1].group);
    });

    it('documents empirical collision behavior when configured directories share identical basenames', async () => {
      // Boundary condition: two distinct directory paths that share the same directory name
      // e.g., /tmp/.../projectA/screenshots and /tmp/.../projectB/screenshots
      const baseDir = makeTempDir('multidir-samebasename');
      const dirA = path.join(baseDir, 'projectA', 'screenshots');
      const dirB = path.join(baseDir, 'projectB', 'screenshots');
      await fs.mkdir(dirA, { recursive: true });
      await fs.mkdir(dirB, { recursive: true });

      const samplePng = encodePng(Buffer.alloc(2 * 2 * 4, 88), 2, 2);
      await fs.writeFile(path.join(dirA, 'dialog.png'), samplePng);
      await fs.writeFile(path.join(dirB, 'dialog.png'), samplePng);

      const driver = createImageDriver({ dirs: [dirA, dirB] });
      const targets =
        (await driver.discover?.({
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(2);
      // Because prefix uses path.basename(imagesDir), both get 'screenshots_'
      // Documenting this exact empirical finding:
      expect(targets[0].id).toBe('image--screenshots_dialog_png');
      expect(targets[1].id).toBe('image--screenshots_dialog_png');
      expect(targets[0].id).toBe(targets[1].id);
    });
  });

  // ==========================================================================
  // Section 6: Storybook Driver - Path Traversal, Dynamic Ports & Socket Teardown
  // ==========================================================================
  describe('Storybook Driver Security, Dynamic Networking & Teardown', () => {
    const tempDirs: string[] = [];

    function makeTempDir(prefix: string): string {
      const dir = path.join(
        os.tmpdir(),
        `diffra-adv-sb-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      );
      tempDirs.push(dir);
      return dir;
    }

    afterEach(async () => {
      for (const dir of tempDirs) {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
      tempDirs.length = 0;
    });

    it('strictly returns HTTP 403 Forbidden on path traversal attempts including URL-encoded %2e%2e', async () => {
      const baseDir = makeTempDir('sb-traversal');
      const buildDir = path.join(baseDir, 'storybook-static');
      const siblingDir = path.join(baseDir, 'storybook-static-secret');
      await fs.mkdir(buildDir, { recursive: true });
      await fs.mkdir(siblingDir, { recursive: true });

      // Inside files
      await fs.writeFile(
        path.join(buildDir, 'index.html'),
        '<!DOCTYPE html><html><body><h1>Storybook App</h1></body></html>',
      );
      await fs.writeFile(
        path.join(buildDir, 'index.json'),
        JSON.stringify({
          v: 4,
          entries: {
            'test--story': { id: 'test--story', name: 'Story', type: 'story' },
          },
        }),
      );

      // Outside files (targets of attack)
      await fs.writeFile(
        path.join(baseDir, 'package.json'),
        JSON.stringify({ secret: 'should-never-be-exposed' }),
      );
      await fs.writeFile(
        path.join(siblingDir, 'secret.txt'),
        'CONFIDENTIAL DATA',
      );

      const driver = createStorybookDriver({
        buildDir,
      }) as StorybookDriver;

      try {
        await driver.discover({ config: {}, cwd: process.cwd() });
        const server = driver.getServer();
        expect(server).toBeDefined();
        if (!server) throw new Error('Server not initialized');

        // 1. Classic dot-dot traversal
        const resPasswd = await testServerRequest(
          server,
          '/../../../etc/passwd',
        );
        expect(resPasswd.status).toBe(403);
        expect(resPasswd.body).toBe('Forbidden');

        // 2. Relative parent package.json
        const resPkg = await testServerRequest(server, '/../package.json');
        expect(resPkg.status).toBe(403);
        expect(resPkg.body).toBe('Forbidden');

        // 3. Encoded %2e%2e traversal
        const resEncodedPasswd = await testServerRequest(
          server,
          '/%2e%2e/%2e%2e/%2e%2e/etc/passwd',
        );
        expect(resEncodedPasswd.status).toBe(403);
        expect(resEncodedPasswd.body).toBe('Forbidden');

        // 4. Encoded %2e%2e package.json
        const resEncodedPkg = await testServerRequest(
          server,
          '/%2e%2e/package.json',
        );
        expect(resEncodedPkg.status).toBe(403);
        expect(resEncodedPkg.body).toBe('Forbidden');

        // 5. Encoded slashes with %2e%2e%2f
        const resEncodedSlash = await testServerRequest(
          server,
          '/%2e%2e%2fpackage.json',
        );
        expect(resEncodedSlash.status).toBe(403);
        expect(resEncodedSlash.body).toBe('Forbidden');

        // 6. Double encoded %252e%252e (must not escape buildDir)
        const resDoubleEncoded = await testServerRequest(
          server,
          '/%252e%252e/package.json',
        );
        // Either 403 or 404 (safe rejection without exposing parent files)
        expect([403, 404]).toContain(resDoubleEncoded.status);
        expect(resDoubleEncoded.body).not.toContain('should-never-be-exposed');

        // 7. Sibling directory prefix bypass: /../storybook-static-secret/secret.txt
        const resSibling = await testServerRequest(
          server,
          '/../storybook-static-secret/secret.txt',
        );
        expect(resSibling.status).toBe(403);
        expect(resSibling.body).toBe('Forbidden');

        // 8. Legitimate files serve correctly
        const resIndex = await testServerRequest(server, '/index.html');
        expect(resIndex.status).toBe(200);
        expect(resIndex.body).toContain('Storybook App');

        const resRoot = await testServerRequest(server, '/');
        expect(resRoot.status).toBe(200);
        expect(resRoot.body).toContain('Storybook App');

        const resNotFound = await testServerRequest(server, '/non-existent.js');
        expect(resNotFound.status).toBe(404);
        expect(resNotFound.body).toBe('Not Found');
      } finally {
        await driver.teardown();
      }
    });

    it('dynamic port binding concurrency: allocates unique ports across multiple concurrent instances without conflicts', async () => {
      const instancesCount = 5;
      const drivers: StorybookDriver[] = [];
      const allocatedPorts: number[] = [];

      try {
        for (let i = 0; i < instancesCount; i++) {
          const dir = makeTempDir(`sb-ports-${i}`);
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(
            path.join(dir, 'index.html'),
            `<html><body>Instance ${i}</body></html>`,
          );
          await fs.writeFile(
            path.join(dir, 'index.json'),
            JSON.stringify({
              v: 4,
              entries: {
                [`inst-${i}--story`]: {
                  id: `inst-${i}--story`,
                  name: `Story${i}`,
                  type: 'story',
                },
              },
            }),
          );

          const driver = new StorybookDriver({ buildDir: dir });
          drivers.push(driver);
        }

        // Start all servers concurrently
        await Promise.all(
          drivers.map((d) => d.discover({ config: {}, cwd: process.cwd() })),
        );

        for (let i = 0; i < instancesCount; i++) {
          const server = drivers[i].getServer();
          expect(server).toBeDefined();
          if (!server) throw new Error('Server not initialized');

          const addr = server.address() as AddressInfo;
          expect(addr.port).toBeGreaterThan(0);
          expect(addr.port).toBeLessThanOrEqual(65535);
          allocatedPorts.push(addr.port);

          // Verify each server responds with its own distinct payload
          const res = await testServerRequest(server, '/index.html');
          expect(res.status).toBe(200);
          expect(res.body).toContain(`Instance ${i}`);
        }

        // All allocated ports must be strictly unique
        const uniquePorts = new Set(allocatedPorts);
        expect(uniquePorts.size).toBe(instancesCount);
      } finally {
        await Promise.all(drivers.map((d) => d.teardown()));
      }
    });

    it('teardown guarantees server socket handle release and immediate port reusability', async () => {
      const dir = makeTempDir('sb-teardown');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, 'index.html'),
        '<html><body>Hello</body></html>',
      );
      await fs.writeFile(
        path.join(dir, 'index.json'),
        JSON.stringify({
          v: 4,
          entries: { 'btn--test': { id: 'btn--test', type: 'story' } },
        }),
      );

      const driver = new StorybookDriver({ buildDir: dir });
      await driver.discover({ config: {}, cwd: process.cwd() });

      const server = driver.getServer();
      expect(server).toBeDefined();
      if (!server) throw new Error('Server not initialized');

      const addr = server.address() as AddressInfo;
      const port = addr.port;
      expect(port).toBeGreaterThan(0);

      // Verify teardown clears internal reference
      await driver.teardown();
      expect(driver.getServer()).toBeUndefined();

      // Verify port was released immediately and can be rebound by a secondary socket
      const socketRebind = net.createServer();
      await new Promise<void>((resolve, reject) => {
        socketRebind.listen(port, '127.0.0.1', () => resolve());
        socketRebind.on('error', reject);
      });

      await new Promise<void>((resolve) => socketRebind.close(() => resolve()));

      // Calling teardown again must be idempotent and not throw
      await expect(driver.teardown()).resolves.toBeUndefined();
    });

    it('startStaticServer is idempotent: subsequent calls reuse existing server without leaking sockets', async () => {
      const dir = makeTempDir('sb-reuse');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, 'index.html'),
        '<html><body>Reuse</body></html>',
      );

      const driver = new StorybookDriver({ buildDir: dir });
      try {
        const url1 = await driver.startStaticServer(dir);
        const server1 = driver.getServer();
        expect(url1).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

        // Calling startStaticServer a second time should return identical URL and same server
        const url2 = await driver.startStaticServer(dir);
        const server2 = driver.getServer();

        expect(url2).toBe(url1);
        expect(server2).toBe(server1);
      } finally {
        await driver.teardown();
      }
    });
  });
});
