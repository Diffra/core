import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BoundedLruCache,
  createFigmaDriver,
  FigmaDriver,
} from '../src/drivers/figma.js';

describe('FigmaDriver', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FIGMA_ENDPOINT;
    delete process.env.FIGMA_BASE_URL;
    delete process.env.FIGMA_ACCESS_TOKEN;
  });

  it('discovers targets from component mapping', async () => {
    const driver = createFigmaDriver({
      fileKey: 'test-file-key',
      components: {
        'Buttons/Primary': '123:45',
        'Cards/UserCard': '123:46',
      },
    });

    const targets = await driver.discover({ config: {}, cwd: process.cwd() });
    expect(targets).toHaveLength(2);
    expect(targets[0].id).toBe('figma--123_45');
    expect(targets[0].name).toBe('Primary');
    expect(targets[0].group).toBe('Buttons');
    expect(targets[1].id).toBe('figma--123_46');
    expect(targets[1].name).toBe('UserCard');
  });

  it('discovers targets from nodeIds list', async () => {
    const driver = new FigmaDriver({
      fileKey: 'test-file-key',
      nodeIds: ['10:1', '10:2'],
    });

    const targets = await driver.discover({ config: {}, cwd: process.cwd() });
    expect(targets).toHaveLength(2);
    expect(targets[0].id).toBe('figma--10_1');
  });

  it('BoundedLruCache evicts oldest entries and updates MRU on access', () => {
    const cache = new BoundedLruCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);

    // Access 'a' to make it most recently used; 'b' becomes oldest
    expect(cache.get('a')).toBe(1);

    // Insert 'c'; 'b' should be evicted
    cache.set('c', 3);
    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);

    // Update existing key
    cache.set('a', 10);
    expect(cache.get('a')).toBe(10);
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('FigmaDriver uses configurable endpoint and baseUrl from options and environment', async () => {
    const customEndpoint = 'https://custom-figma.internal.domain';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        document: {
          children: [
            {
              name: 'Page 1',
              children: [{ id: '99:1', name: 'HeaderFrame', type: 'FRAME' }],
            },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const driver = new FigmaDriver({
      fileKey: 'sample-file',
      endpoint: customEndpoint,
      personalAccessToken: 'token-abc',
    });

    const targets = await driver.discover({ config: {}, cwd: process.cwd() });
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('figma--99_1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      `${customEndpoint}/v1/files/sample-file`,
    );

    // Also test FIGMA_ENDPOINT environment variable fallback
    fetchMock.mockClear();
    process.env.FIGMA_ENDPOINT = 'https://env-figma.internal';
    const envDriver = new FigmaDriver({
      fileKey: 'sample-file-env',
      personalAccessToken: 'token-abc',
    });
    await envDriver.discover({ config: {}, cwd: process.cwd() });
    expect(fetchMock.mock.calls[0][0]).toContain(
      'https://env-figma.internal/v1/files/sample-file-env',
    );
  });

  it('FigmaDriver handles HTTP 429 rate limit with Retry-After backoff and succeeds', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (url.includes('/v1/images/')) {
        if (callCount === 1) {
          // First attempt: 429 rate limit with Retry-After 0
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers({ 'retry-after': '0' }),
          });
        }
        // Second attempt: 200 OK with image metadata
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            images: { '10:1': 'https://mock-s3.figma.com/image-10-1.png' },
          }),
        });
      }
      // Image download
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const driver = new FigmaDriver({
      fileKey: 'file-123',
      personalAccessToken: 'token-xyz',
      maxRetries: 2,
    });

    const task = {
      target: {
        id: 'figma--10_1',
        name: 'Frame',
        metadata: { figmaNodeId: '10:1' },
      },
      viewport: { width: 800, height: 600 },
    };

    const buffer = await driver.capture(task, {
      config: {},
      cwd: process.cwd(),
    });
    expect(buffer).not.toBeNull();
    expect(buffer?.length).toBe(8);
    expect(callCount).toBeGreaterThanOrEqual(3); // 1st images attempt (429), 2nd images attempt (200), 3rd image download
  });

  it('FigmaDriver surfaces diagnostics for 401, 404, and missing node IDs', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 1. HTTP 401 Unauthorized
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }),
    );

    const authDriver = new FigmaDriver({
      fileKey: 'auth-test',
      personalAccessToken: 'bad-token',
    });
    const authTargets = await authDriver.discover({
      config: {},
      cwd: process.cwd(),
    });
    expect(authTargets).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Figma API authentication failed (401)'),
    );

    // 2. HTTP 404 Not Found
    warnSpy.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    const notFoundDriver = new FigmaDriver({
      fileKey: 'nonexistent-file',
      personalAccessToken: 'token',
    });
    const notFoundTargets = await notFoundDriver.discover({
      config: {},
      cwd: process.cwd(),
    });
    expect(notFoundTargets).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Figma file not found (404)'),
    );

    // 3. Missing node in image response
    warnSpy.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          images: { '99:99': null }, // Node missing
        }),
      }),
    );

    const missingNodeDriver = new FigmaDriver({
      fileKey: 'file-with-missing-node',
      personalAccessToken: 'token',
    });
    const missingNodeResults = await missingNodeDriver.captureAll(
      [
        {
          target: {
            id: 'figma--99_99',
            name: 'GhostFrame',
            metadata: { figmaNodeId: '99:99' },
          },
          viewport: { width: 800, height: 600 },
        },
      ],
      { config: {}, cwd: process.cwd() },
    );

    expect(missingNodeResults).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Figma frame 99:99 was not found in file'),
    );
  });

  it('FigmaDriver teardown clears in-memory image cache', () => {
    const driver = new FigmaDriver({ fileKey: 'test-file' });
    const cache = driver.getCache();
    cache.set('url-1', Buffer.from('img-1'));
    cache.set('url-2', Buffer.from('img-2'));
    expect(cache.size).toBe(2);

    driver.teardown();
    expect(cache.size).toBe(0);
  });
});
