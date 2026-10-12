import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { encodePng } from '@diffra/engine';
import { describe, expect, it } from 'vitest';
import {
  createImageDriver,
  createStorybookDriver,
  createUrlDriver,
  PNG_SIGNATURE,
  resolveDrivers,
  StorybookDriver,
  validatePngFile,
} from '../src/drivers/index.js';
import type { VisualDriver, VisualTarget } from '../src/types/index.js';

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

describe('Pluggable Driver Ecosystem', () => {
  it('resolves default StorybookDriver when no specific driver configured', () => {
    const drivers = resolveDrivers({});
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('storybook');
  });

  it('resolves UrlDriver when typed url driver config is provided', () => {
    const drivers = resolveDrivers({
      drivers: {
        driver: 'url',
        urls: ['/home', '/pricing'],
      },
    });
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('url');
  });

  it('resolves ImageDriver when typed image driver config is provided', () => {
    const drivers = resolveDrivers({
      drivers: {
        driver: 'image',
        dir: './fixtures/screenshots',
      },
    });
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('image');
  });

  it('resolves in-memory target list driver when targets are provided', async () => {
    const sampleTargets: VisualTarget[] = [
      { id: 'custom-1', name: 'Custom Modal', group: 'Modals' },
      { id: 'custom-2', name: 'Custom Banner', group: 'Banners' },
    ];

    const drivers = resolveDrivers({
      targets: sampleTargets,
    });
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('targets');

    const discovered = await drivers[0].discover?.({
      config: { targets: sampleTargets },
      cwd: process.cwd(),
    });
    expect(discovered).toEqual(sampleTargets);
  });

  it('supports custom downstream VisualDriver objects', async () => {
    const customDriver: VisualDriver = {
      name: 'playwright-e2e',
      discover: async () => [
        {
          id: 'flow--checkout',
          name: 'Checkout Flow',
          group: 'E2E',
          url: 'http://localhost:3000/checkout',
        },
      ],
      capture: async () => Buffer.from('mock-png-data'),
    };

    const drivers = resolveDrivers({
      drivers: customDriver,
    });
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('playwright-e2e');

    const discovered = await drivers[0].discover?.({
      config: { drivers: customDriver },
      cwd: process.cwd(),
    });
    expect(discovered).toHaveLength(1);
    expect(discovered[0].id).toBe('flow--checkout');
  });

  it('supports multi-driver configurations', () => {
    const customDriver: VisualDriver = {
      name: 'custom-tool',
      discover: async () => [],
    };

    const drivers = resolveDrivers({
      drivers: ['storybook', 'url', customDriver],
    });
    expect(drivers).toHaveLength(3);
    expect(drivers[0].name).toBe('storybook');
    expect(drivers[1].name).toBe('url');
    expect(drivers[2].name).toBe('custom-tool');
  });

  it('UrlDriver discovers clean normalized visual targets from routes', async () => {
    const driver = createUrlDriver({
      baseUrl: 'https://example.com',
      urls: [
        '/',
        '/pricing-table',
        {
          url: '/dashboard',
          name: 'Analytics Dashboard',
          group: 'App',
          snapshot: {
            selector: '#analytics-grid',
            delay: 150,
          },
        },
      ],
    });
    const targets = await driver.discover?.({
      config: {},
      cwd: process.cwd(),
    });

    expect(targets).toHaveLength(3);
    expect(targets[0].id).toBe('route--home');
    expect(targets[0].name).toBe('Home');
    expect(targets[0].url).toBe('https://example.com/');

    expect(targets[1].id).toBe('route--pricing_table');
    expect(targets[1].name).toBe('pricing table');
    expect(targets[1].url).toBe('https://example.com/pricing-table');

    expect(targets[2].id).toBe('route--dashboard');
    expect(targets[2].name).toBe('Analytics Dashboard');
    expect(targets[2].group).toBe('App');
    expect(targets[2].snapshot?.selector).toBe('#analytics-grid');
    expect(targets[2].snapshot?.delay).toBe(150);
  });

  it('StorybookDriver parseStoryIndex parses canonical index.json entries accurately', () => {
    const driver = new StorybookDriver();
    const mockIndex = {
      v: 4,
      entries: {
        'components-button--primary': {
          id: 'components-button--primary',
          title: 'Components/Button',
          name: 'Primary',
          importPath: './src/Button.stories.tsx',
          type: 'story',
          parameters: {
            snapshot: { delay: 200, diffThreshold: 0.05 },
          },
        },
        'components-button--disabled': {
          id: 'components-button--disabled',
          title: 'Components/Button',
          name: 'Disabled',
          importPath: './src/Button.stories.tsx',
          type: 'story',
        },
        'components-button--docs': {
          id: 'components-button--docs',
          title: 'Components/Button',
          name: 'Docs',
          importPath: './src/Button.mdx',
          type: 'docs',
        },
        'components-modal--skipped': {
          id: 'components-modal--skipped',
          title: 'Components/Modal',
          name: 'Skipped',
          type: 'story',
          parameters: {
            snapshot: { disableSnapshot: true },
          },
        },
      },
    };

    const targets = driver.parseStoryIndex(mockIndex, 'http://localhost:6006');

    expect(targets).toHaveLength(2);
    expect(targets[0].id).toBe('components-button--primary');
    expect(targets[0].name).toBe('Primary');
    expect(targets[0].group).toBe('Button');
    expect(targets[0].url).toBe(
      'http://localhost:6006/iframe.html?id=components-button--primary&viewMode=story',
    );
    expect(targets[0].snapshot?.delay).toBe(200);

    expect(targets[1].id).toBe('components-button--disabled');
    expect(targets[1].name).toBe('Disabled');
  });

  it('StorybookDriver starts static preview server on dynamic port 0 when buildDir exists', async () => {
    const tmpDir = path.join(
      os.tmpdir(),
      `diffra-sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    );
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'index.json'),
      JSON.stringify({
        v: 4,
        entries: {
          'demo--button': {
            id: 'demo--button',
            title: 'Components/Button',
            name: 'Primary',
            type: 'story',
            parameters: { snapshot: { delay: 100 } },
          },
        },
      }),
    );
    await fs.writeFile(
      path.join(tmpDir, 'iframe.html'),
      '<!DOCTYPE html><html><body><h1>Storybook Preview</h1></body></html>',
    );

    const driver = createStorybookDriver({
      buildDir: tmpDir,
    }) as StorybookDriver;
    try {
      const targets = await driver.discover({
        config: {},
        cwd: process.cwd(),
      });
      expect(targets).toHaveLength(1);
      const server = driver.getServer();
      expect(server).toBeDefined();
      if (!server) throw new Error('Server not initialized');
      const addr = server.address() as AddressInfo;
      expect(addr.port).toBeGreaterThan(0);
      expect(targets[0].url).toContain(
        `:${addr.port}/iframe.html?id=demo--button`,
      );

      // Verify server actually serves content over HTTP handler
      const res = await testServerRequest(server, '/iframe.html');
      expect(res.status).toBe(200);
      expect(res.body).toContain('Storybook Preview');
    } finally {
      await driver.teardown();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('StorybookDriver static preview server rejects path traversal with 403 Forbidden', async () => {
    const tmpDir = path.join(os.tmpdir(), `diffra-sb-sec-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'index.json'),
      JSON.stringify({
        v: 4,
        entries: { 'a--b': { id: 'a--b', type: 'story' } },
      }),
    );

    const driver = createStorybookDriver({
      buildDir: tmpDir,
    }) as StorybookDriver;
    try {
      await driver.discover({ config: {}, cwd: process.cwd() });
      const server = driver.getServer();
      expect(server).toBeDefined();
      if (!server) throw new Error('Server not initialized');
      const addr = server.address() as AddressInfo;
      expect(addr.port).toBeGreaterThan(0);

      const res = await testServerRequest(server, '/../../etc/passwd');
      expect(res.status).toBe(403);
      expect(res.body).toBe('Forbidden');
    } finally {
      await driver.teardown();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('StorybookDriver surfaces clear SyntaxError diagnostic on malformed index.json', async () => {
    const tmpDir = path.join(os.tmpdir(), `diffra-sb-err-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'index.json'),
      '{ malformed json: not valid }',
    );

    const driver = createStorybookDriver({ buildDir: tmpDir });
    try {
      await expect(
        driver.discover?.({ config: {}, cwd: process.cwd() }),
      ).rejects.toThrow(/Failed to parse Storybook index file at/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('StorybookDriver strictly ignores parameters.visual and parameters.diffra per AGENTS.md Rule 2', () => {
    const driver = new StorybookDriver();
    const mockIndex = {
      v: 4,
      entries: {
        'comp--button': {
          id: 'comp--button',
          title: 'Button',
          name: 'Button',
          type: 'story',
          parameters: {
            visual: { delay: 999 },
            diffra: { delay: 888 },
          },
        },
      },
    };

    const targets = driver.parseStoryIndex(mockIndex, 'http://dynamic.preview');
    expect(targets).toHaveLength(1);
    expect(targets[0].snapshot?.delay).toBeUndefined();
  });

  it('UrlDriver incorporates query parameters and hash fragments to prevent target ID collisions', async () => {
    const driver = createUrlDriver({
      baseUrl: 'https://example.com',
      urls: [
        '/search?q=shoes',
        '/search?q=hats',
        '/dashboard#overview',
        '/dashboard#reports',
      ],
    });

    const targets = await driver.discover?.({
      config: {},
      cwd: process.cwd(),
    });
    expect(targets).toHaveLength(4);
    const ids = targets.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(4);
    expect(ids[0]).toBe('route--search_q_shoes');
    expect(ids[1]).toBe('route--search_q_hats');
    expect(ids[2]).toBe('route--dashboard_overview');
    expect(ids[3]).toBe('route--dashboard_reports');
  });

  it('UrlDriver propagates custom headers, auth credentials, and cookies to target metadata', async () => {
    const driver = createUrlDriver({
      baseUrl: 'https://auth.example.com',
      headers: { 'X-Global-Header': 'val' },
      urls: [
        {
          url: '/protected',
          name: 'Protected View',
          headers: { Authorization: 'Bearer token-123' },
          auth: { username: 'admin', password: 'secret' },
          cookies: [{ name: 'session', value: 'xyz789' }],
        },
      ],
    });

    const targets = await driver.discover?.({
      config: {},
      cwd: process.cwd(),
    });
    expect(targets).toHaveLength(1);
    expect(targets[0].metadata?.headers).toEqual({
      Authorization: 'Bearer token-123',
    });
    expect(targets[0].metadata?.auth).toEqual({
      username: 'admin',
      password: 'secret',
    });
    expect(targets[0].metadata?.cookies).toEqual([
      { name: 'session', value: 'xyz789' },
    ]);
  });

  it('UrlDriver discovers routes from context.config when options are omitted', async () => {
    const driver = createUrlDriver();
    const targets = await driver.discover?.({
      config: {
        drivers: {
          driver: 'url',
          baseUrl: 'https://fallback.domain',
          urls: ['/from-config'],
        },
      },
      cwd: process.cwd(),
    });

    expect(targets).toHaveLength(1);
    expect(targets[0].url).toBe('https://fallback.domain/from-config');
    expect(targets[0].id).toBe('route--from_config');
  });

  it('ImageDriver discovers valid PNG files across multiple directories', async () => {
    const baseDir = path.join(os.tmpdir(), `diffra-img-multi-${Date.now()}`);
    const dirA = path.join(baseDir, 'desktop');
    const dirB = path.join(baseDir, 'mobile');
    await fs.mkdir(dirA, { recursive: true });
    await fs.mkdir(dirB, { recursive: true });

    const png = encodePng(Buffer.alloc(4 * 4 * 4, 100), 4, 4);
    await fs.writeFile(path.join(dirA, 'hero.png'), png);
    await fs.writeFile(path.join(dirB, 'hero.png'), png);

    const driver = createImageDriver({ dirs: [dirA, dirB] });
    try {
      const targets = await driver.discover?.({
        config: {},
        cwd: process.cwd(),
      });
      expect(targets).toHaveLength(2);
      expect(targets[0].id).not.toBe(targets[1].id);
      expect(targets.some((t) => t.id.includes('desktop_hero'))).toBe(true);
      expect(targets.some((t) => t.id.includes('mobile_hero'))).toBe(true);
    } finally {
      await fs.rm(baseDir, { recursive: true, force: true });
    }
  });

  it('ImageDriver skips 0-byte and corrupted PNG files during discovery and capture', async () => {
    const baseDir = path.join(os.tmpdir(), `diffra-img-corrupt-${Date.now()}`);
    await fs.mkdir(baseDir, { recursive: true });

    await fs.writeFile(path.join(baseDir, 'zero-byte.png'), Buffer.alloc(0));
    await fs.writeFile(
      path.join(baseDir, 'corrupt-header.png'),
      Buffer.from('NOT_PNG_HEADER'),
    );
    const validPng = encodePng(Buffer.alloc(2 * 2 * 4, 255), 2, 2);
    await fs.writeFile(path.join(baseDir, 'valid.png'), validPng);

    const driver = createImageDriver({ dir: baseDir });
    try {
      const targets = await driver.discover?.({
        config: {},
        cwd: process.cwd(),
      });
      expect(targets).toHaveLength(1);
      expect(targets[0].name).toBe('valid');

      // Test capture on invalid targets
      const zeroTask = {
        target: {
          id: 't1',
          name: 't1',
          filePath: path.join(baseDir, 'zero-byte.png'),
        },
        viewport: { width: 100, height: 100 },
      };
      const corruptTask = {
        target: {
          id: 't2',
          name: 't2',
          filePath: path.join(baseDir, 'corrupt-header.png'),
        },
        viewport: { width: 100, height: 100 },
      };
      const validTask = {
        target: {
          id: 't3',
          name: 't3',
          filePath: path.join(baseDir, 'valid.png'),
        },
        viewport: { width: 100, height: 100 },
      };

      const buf0 = await driver.capture?.(zeroTask, {
        config: {},
        cwd: process.cwd(),
      });
      const bufCorrupt = await driver.capture?.(corruptTask, {
        config: {},
        cwd: process.cwd(),
      });
      const bufValid = await driver.capture?.(validTask, {
        config: {},
        cwd: process.cwd(),
      });

      expect(buf0).toBeNull();
      expect(bufCorrupt).toBeNull();
      expect(bufValid).not.toBeNull();
      expect(bufValid?.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    } finally {
      await fs.rm(baseDir, { recursive: true, force: true });
    }
  });

  it('validatePngFile correctly identifies PNG magic signature', async () => {
    const tmpDir = path.join(os.tmpdir(), `diffra-magic-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    const validPath = path.join(tmpDir, 'valid.png');
    const zeroPath = path.join(tmpDir, 'zero.png');
    const shortPath = path.join(tmpDir, 'short.png');
    const invalidPath = path.join(tmpDir, 'invalid.png');

    await fs.writeFile(validPath, encodePng(Buffer.alloc(1 * 1 * 4, 1), 1, 1));
    await fs.writeFile(zeroPath, Buffer.alloc(0));
    await fs.writeFile(shortPath, Buffer.from([0x89, 0x50]));
    await fs.writeFile(invalidPath, Buffer.from('1234567890'));

    try {
      expect((await validatePngFile(validPath)).valid).toBe(true);
      expect((await validatePngFile(zeroPath)).valid).toBe(false);
      expect((await validatePngFile(shortPath)).valid).toBe(false);
      expect((await validatePngFile(invalidPath)).valid).toBe(false);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
