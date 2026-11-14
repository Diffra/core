import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SERVER_HOST,
  formatServerUrl,
  type StaticServer,
  startStaticServer,
} from '../../src/server/static.js';

interface Response {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/**
 * Sends the path exactly as given. Unlike fetch, http.request does not
 * normalise `..` segments, so traversal attempts reach the server intact.
 */
function get(server: StaticServer, rawPath: string): Promise<Response> {
  const { port } = server.server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: DEFAULT_SERVER_HOST, port, path: rawPath, agent: false },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf-8'),
          }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('static file server', () => {
  let base: string;
  let root: string;
  let server: StaticServer | undefined;

  beforeEach(async () => {
    base = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-static-'));
    root = path.join(base, 'site');
    await fs.mkdir(path.join(root, 'docs'), { recursive: true });
    await fs.writeFile(path.join(root, 'index.html'), '<h1>home</h1>');
    await fs.writeFile(path.join(root, 'docs', 'index.html'), '<h1>docs</h1>');
    await fs.writeFile(path.join(root, 'data.json'), '{"ok":true}');
    await fs.writeFile(path.join(root, 'shot.png'), 'png-bytes');
    // Files an attacker would want, beside and above the served directory.
    await fs.writeFile(path.join(base, 'secret.txt'), 'TOP SECRET');
    await fs.mkdir(`${root}-private`, { recursive: true });
    await fs.writeFile(path.join(`${root}-private`, 'key.txt'), 'PRIVATE KEY');
  });

  afterEach(async () => {
    await server?.stop();
    server = undefined;
    await fs.rm(base, { recursive: true, force: true });
    await fs.rm(`${root}-private`, { recursive: true, force: true });
  });

  async function serve(options: { indexFile?: string } = {}) {
    server = await startStaticServer({ root, ...options });
    return server;
  }

  it('serves files with their content type and refuses content sniffing', async () => {
    const s = await serve();
    const json = await get(s, '/data.json');
    expect(json.status).toBe(200);
    expect(json.headers['content-type']).toBe(
      'application/json; charset=utf-8',
    );
    expect(json.headers['x-content-type-options']).toBe('nosniff');
    expect(JSON.parse(json.body)).toEqual({ ok: true });

    expect((await get(s, '/shot.png')).headers['content-type']).toBe(
      'image/png',
    );
  });

  it('answers a directory with its index file', async () => {
    const s = await serve();
    expect((await get(s, '/')).body).toBe('<h1>home</h1>');
    expect((await get(s, '/docs')).body).toBe('<h1>docs</h1>');
    expect((await get(s, '/docs/')).body).toBe('<h1>docs</h1>');
  });

  it('uses a configured index file', async () => {
    await fs.writeFile(path.join(root, 'review.html'), 'review page');
    const s = await serve({ indexFile: 'review.html' });
    expect((await get(s, '/')).body).toBe('review page');
  });

  it('ignores the query string and fragment when choosing the file', async () => {
    const s = await serve();
    expect((await get(s, '/data.json?cache=1#top')).status).toBe(200);
    // A malformed query must not break routing or open a way out.
    expect((await get(s, '/data.json?x=%E0%A4%A&y=%')).status).toBe(200);
  });

  it('returns 404 for a missing file without revealing anything', async () => {
    const response = await get(await serve(), '/nothing-here.txt');
    expect(response.status).toBe(404);
    expect(response.body).toBe('Not found');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  describe('path traversal', () => {
    const attempts: Record<string, string> = {
      'dot-dot segments': '/../secret.txt',
      'deeply nested dot-dot': '/docs/../../secret.txt',
      'encoded dot-dot': '/%2e%2e/secret.txt',
      'encoded dot-dot and slash': '/%2e%2e%2fsecret.txt',
      'mixed-case encoding': '/%2E%2e/secret.txt',
      'a sibling directory sharing the name prefix': '/../site-private/key.txt',
      'an encoded sibling directory': '/%2e%2e/site-private/key.txt',
    };

    for (const [name, rawPath] of Object.entries(attempts)) {
      it(`refuses ${name}`, async () => {
        const response = await get(await serve(), rawPath);
        expect(response.status).toBe(403);
        expect(response.body).toBe('Forbidden');
        expect(response.body).not.toContain('SECRET');
        expect(response.body).not.toContain('PRIVATE');
      });
    }

    it('refuses a malformed percent-encoding instead of guessing', async () => {
      expect((await get(await serve(), '/%E0%A4%A')).status).toBe(403);
    });

    it('does not decode twice', async () => {
      const response = await get(await serve(), '/%252e%252e/secret.txt');
      // The decoded path is a literal "%2e%2e" directory, which does not exist.
      expect(response.status).toBe(404);
      expect(response.body).not.toContain('SECRET');
    });

    it.skipIf(process.platform === 'win32')(
      'refuses a symlink that points outside the root',
      async () => {
        await fs.symlink(
          path.join(base, 'secret.txt'),
          path.join(root, 'link.txt'),
        );
        await fs.symlink(`${root}-private`, path.join(root, 'linked-dir'));
        const s = await serve();

        for (const rawPath of ['/link.txt', '/linked-dir/key.txt']) {
          const response = await get(s, rawPath);
          expect(response.status).toBe(403);
          expect(response.body).not.toContain('SECRET');
          expect(response.body).not.toContain('PRIVATE');
        }
      },
    );
  });

  describe('listening', () => {
    it('binds a free port on the loopback interface by default', async () => {
      const s = await serve();
      const address = s.server.address() as AddressInfo;
      expect(address.port).toBeGreaterThan(0);
      expect(address.address).toBe(DEFAULT_SERVER_HOST);
      expect(s.url).toBe(`http://${DEFAULT_SERVER_HOST}:${address.port}`);
      expect(s.port).toBe(address.port);
    });

    it('gives concurrent servers distinct ports', async () => {
      const [a, b] = await Promise.all([
        startStaticServer({ root }),
        startStaticServer({ root }),
      ]);
      try {
        expect(a.port).not.toBe(b.port);
      } finally {
        await Promise.all([a.stop(), b.stop()]);
      }
    });

    it('releases the port on stop, even with an open keep-alive connection', async () => {
      const s = await serve();
      const { port } = s;
      const agent = new http.Agent({ keepAlive: true });
      await new Promise<void>((resolve, reject) => {
        http
          .get({ host: DEFAULT_SERVER_HOST, port, path: '/', agent }, (res) => {
            res.resume();
            res.on('end', () => resolve());
          })
          .on('error', reject);
      });

      await s.stop();
      server = undefined;
      agent.destroy();

      const reused = await startStaticServer({ root, port });
      try {
        expect(reused.port).toBe(port);
      } finally {
        await reused.stop();
      }
    });

    it('stops cleanly when called twice', async () => {
      const s = await serve();
      await s.stop();
      await expect(s.stop()).resolves.toBeUndefined();
      server = undefined;
    });
  });

  describe('formatServerUrl', () => {
    const serverAt = (address: unknown) =>
      ({ address: () => address }) as unknown as http.Server;

    it('writes IPv4 and IPv6 addresses as valid URLs', () => {
      expect(
        formatServerUrl(
          serverAt({ family: 'IPv4', address: '10.0.0.5', port: 8080 }),
        ),
      ).toBe('http://10.0.0.5:8080');
      expect(
        formatServerUrl(
          serverAt({ family: 'IPv6', address: '::1', port: 8080 }),
        ),
      ).toBe('http://[::1]:8080');
    });

    it('shows a wildcard address as a reachable local address', () => {
      expect(
        formatServerUrl(serverAt({ family: 'IPv6', address: '::', port: 9 })),
      ).toBe('http://127.0.0.1:9');
      expect(
        formatServerUrl(
          serverAt({ family: 'IPv4', address: '0.0.0.0', port: 9 }),
        ),
      ).toBe('http://127.0.0.1:9');
    });

    it('falls back when the server is not listening', () => {
      expect(formatServerUrl(serverAt(null))).toBe('http://127.0.0.1');
    });
  });
});
