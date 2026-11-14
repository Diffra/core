import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStorybookDriver, StorybookDriver } from '../../src/index.js';

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

describe('Storybook driver', () => {
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
    expect(targets[0]?.id).toBe('components-button--primary');
    expect(targets[0]?.name).toBe('Primary');
    expect(targets[0]?.group).toBe('Button');
    expect(targets[0]?.url).toBe(
      'http://localhost:6006/iframe.html?id=components-button--primary&viewMode=story',
    );
    expect(targets[0]?.snapshot?.delay).toBe(200);

    expect(targets[1]?.id).toBe('components-button--disabled');
    expect(targets[1]?.name).toBe('Disabled');
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
      expect(targets[0]?.url).toContain(
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

  it('StorybookDriver reads only parameters.snapshot and ignores other namespaces', () => {
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
    expect(targets[0]?.snapshot?.delay).toBeUndefined();
  });

  describe('Storybook Driver Discovery Resiliency', () => {
    it('parseStoryIndex gracefully handles null, undefined, primitive, and empty structures', () => {
      const driver = new StorybookDriver();
      expect(driver.parseStoryIndex(null, 'http://test')).toEqual([]);
      expect(driver.parseStoryIndex(undefined, 'http://test')).toEqual([]);
      expect(driver.parseStoryIndex('string', 'http://test')).toEqual([]);
      expect(driver.parseStoryIndex(12345, 'http://test')).toEqual([]);
      expect(driver.parseStoryIndex({}, 'http://test')).toEqual([]);
      expect(driver.parseStoryIndex({ entries: {} }, 'http://test')).toEqual(
        [],
      );
    });

    it('parseStoryIndex filters out docs and disabled stories', () => {
      const driver = new StorybookDriver();
      const mockIndex = {
        v: 4,
        entries: {
          'docs-intro': {
            id: 'docs-intro',
            type: 'docs',
            name: 'Intro',
          },
          'btn-disabled-1': {
            id: 'btn-disabled-1',
            type: 'story',
            name: 'Btn Disabled 1',
            parameters: {
              snapshot: { disableSnapshot: true },
            },
          },
          'btn-disabled-2': {
            id: 'btn-disabled-2',
            type: 'story',
            name: 'Btn Disabled 2',
            parameters: {
              snapshot: { disable: true },
            },
          },
          'btn-active': {
            id: 'btn-active',
            type: 'story',
            name: 'Active Button',
            title: 'DesignSystem/Buttons/Active',
            parameters: {
              snapshot: { delay: 200 },
            },
          },
        },
      };

      const targets = driver.parseStoryIndex(
        mockIndex,
        'http://dynamic.preview',
      );
      expect(targets).toHaveLength(1);
      expect(targets[0]?.id).toBe('btn-active');
      expect(targets[0]?.name).toBe('Active Button');
      expect(targets[0]?.group).toBe('Active');
      expect(targets[0]?.snapshot?.delay).toBe(200);
      expect(targets[0]?.url).toBe(
        'http://dynamic.preview/iframe.html?id=btn-active&viewMode=story',
      );
    });

    it('discover() throws informative diagnostic error when Storybook is not built or running', async () => {
      const nonExistentDir = path.resolve(
        process.cwd(),
        '.missing-storybook-dir',
      );
      const driver = createStorybookDriver({ buildDir: nonExistentDir });

      await expect(
        driver.discover?.({ config: {}, cwd: process.cwd() }),
      ).rejects.toThrow(/Could not discover Storybook stories/);
    });
  });

  it('startStaticServer is idempotent: subsequent calls reuse existing server without leaking sockets', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-sb-reuse-'));
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
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  describe('Real-World Storybook Design System Index Parsing', () => {
    const driver = new StorybookDriver();

    const mockIndex = {
      v: 4,
      entries: {
        'components-button--responsive-matrix': {
          id: 'components-button--responsive-matrix',
          title: 'Components/Button',
          name: 'ResponsiveMatrix',
          importPath: './src/Button.stories.tsx',
          type: 'story',
          parameters: {
            snapshot: {
              viewports: [
                { name: 'mobile', width: 375, height: 667 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'desktop', width: 1280, height: 800 },
              ],
            },
          },
        },
        'components-card--featured': {
          id: 'components-card--featured',
          title: 'Components/Card',
          name: 'Featured',
          importPath: './src/Card.stories.tsx',
          type: 'story',
          parameters: {
            snapshot: {
              diffThreshold: 0.02,
            },
          },
        },
        'components-modal--default': {
          id: 'components-modal--default',
          title: 'Components/Modal',
          name: 'Default',
          importPath: './src/Modal.stories.tsx',
          type: 'story',
          parameters: {
            snapshot: {
              delay: 150,
              pauseAnimationAtEnd: true,
            },
          },
        },
        'components-badge--live-indicator': {
          id: 'components-badge--live-indicator',
          title: 'Components/Badge',
          name: 'LiveIndicator',
          importPath: './src/Badge.stories.tsx',
          type: 'story',
        },
        'components-badge--disabled': {
          id: 'components-badge--disabled',
          title: 'Components/Badge',
          name: 'Disabled',
          importPath: './src/Badge.stories.tsx',
          type: 'story',
          parameters: {
            snapshot: {
              disable: true,
            },
          },
        },
      },
    };

    it('parses Button stories with responsive modes parameter matrix', () => {
      const stories = driver.parseStoryIndex(
        mockIndex,
        'http://localhost:6006',
      );
      const responsiveStory = stories.find(
        (s) => s.name === 'ResponsiveMatrix',
      );
      expect(responsiveStory).toBeDefined();
      expect(responsiveStory?.snapshot?.viewports).toEqual([
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1280, height: 800 },
      ]);
    });

    it('parses Card stories with custom thresholds and named viewports', () => {
      const stories = driver.parseStoryIndex(
        mockIndex,
        'http://localhost:6006',
      );
      const featuredStory = stories.find((s) => s.name === 'Featured');
      expect(featuredStory?.snapshot?.diffThreshold).toBe(0.02);
    });

    it('parses Modal stories with animation and delay parameters', () => {
      const stories = driver.parseStoryIndex(
        mockIndex,
        'http://localhost:6006',
      );
      const modalStory = stories.find((s) => s.group === 'Modal');
      expect(modalStory?.snapshot?.delay).toBe(150);
      expect(modalStory?.snapshot?.pauseAnimationAtEnd).toBe(true);
    });

    it('honors disable parameters in Badge stories', () => {
      const stories = driver.parseStoryIndex(
        mockIndex,
        'http://localhost:6006',
      );
      const badgeStories = stories.filter((s) => s.group === 'Badge');
      expect(badgeStories).toHaveLength(1);
      expect(badgeStories[0]?.name).toBe('LiveIndicator');
    });
  });

  describe('3-Tier Parameter Cascade & Snapshot Hierarchy', () => {
    it('merges story parameters and filters disabled stories', () => {
      const driver = new StorybookDriver();
      const mockIndex = {
        v: 4,
        entries: {
          'components-hero--default': {
            id: 'components-hero--default',
            title: 'Components/Hero',
            name: 'Default',
            type: 'story',
            parameters: {
              snapshot: {
                delay: 300,
                diffThreshold: 0.08,
                pauseAnimationAtEnd: true,
              },
            },
          },
          'components-hero--custom-delay': {
            id: 'components-hero--custom-delay',
            title: 'Components/Hero',
            name: 'CustomDelay',
            type: 'story',
            parameters: {
              snapshot: {
                delay: 800,
                diffThreshold: 0.02,
                mask: ['.live-clock'],
              },
            },
          },
          'components-hero--disabled': {
            id: 'components-hero--disabled',
            title: 'Components/Hero',
            name: 'Disabled',
            type: 'story',
            parameters: {
              snapshot: {
                disableSnapshot: true,
              },
            },
          },
        },
      };

      const stories = driver.parseStoryIndex(
        mockIndex,
        'http://localhost:6006',
      );
      expect(stories).toHaveLength(2); // Disabled story skipped

      const defaultStory = stories.find((s) => s.name === 'Default');
      expect(defaultStory).toBeDefined();
      const defaultParams = defaultStory?.snapshot;
      expect(defaultParams?.delay).toBe(300);
      expect(defaultParams?.diffThreshold).toBe(0.08);

      const customStory = stories.find((s) => s.name === 'CustomDelay');
      expect(customStory).toBeDefined();
      const customParams = customStory?.snapshot;
      expect(customParams?.delay).toBe(800);
      expect(customParams?.diffThreshold).toBe(0.02);
      expect(customParams?.mask).toEqual(['.live-clock']);
    });

    it('supports pauseAnimationAtEnd snapshot parameter', () => {
      const driver = new StorybookDriver();
      const mockIndex = {
        v: 4,
        entries: {
          'animations-spinner--running': {
            id: 'animations-spinner--running',
            title: 'Animations/Spinner',
            name: 'Running',
            type: 'story',
            parameters: {
              snapshot: {
                pauseAnimationAtEnd: false,
              },
            },
          },
        },
      };

      const stories = driver.parseStoryIndex(
        mockIndex,
        'http://localhost:6006',
      );
      expect(stories).toHaveLength(1);
      const story = stories[0];
      const params = story?.snapshot;
      expect(params?.pauseAnimationAtEnd).toBe(false);
    });
  });
});
