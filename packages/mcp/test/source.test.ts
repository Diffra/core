import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DirectorySource, UrlSource } from '../src/source.js';

describe('DirectorySource', () => {
  let dir: string;
  let outside: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-bundle-'));
    outside = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-outside-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  it('refuses a symbolic link that points outside the bundle', async () => {
    await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
    await fs.symlink(
      path.join(outside, 'secret.txt'),
      path.join(dir, 'image.png'),
    );
    await expect(
      new DirectorySource(dir).readImage('image.png'),
    ).rejects.toThrow(/leaves the review bundle/);
  });

  it('still reads a file inside the bundle', async () => {
    await fs.mkdir(path.join(dir, 'images'));
    await fs.writeFile(path.join(dir, 'images', 'a.png'), 'ok');
    const bytes = await new DirectorySource(dir).readImage('images/a.png');
    expect(bytes.toString()).toBe('ok');
  });
});

describe('UrlSource', () => {
  let server: http.Server;
  let base: string;
  let other: http.Server;
  let otherBase: string;
  let handler: http.RequestListener;

  const listen = (s: http.Server) =>
    new Promise<string>((resolve) =>
      s.listen(0, () => {
        const { address, port } = s.address() as AddressInfo;
        resolve(
          `http://${address.includes(':') ? `[${address}]` : address}:${port}`,
        );
      }),
    );

  beforeEach(async () => {
    server = http.createServer((req, res) => handler(req, res));
    other = http.createServer((_req, res) => res.end('internal'));
    base = await listen(server);
    otherBase = await listen(other);
  });
  afterEach(async () => {
    server.closeAllConnections();
    other.closeAllConnections();
    await Promise.all([
      new Promise((r) => server.close(r)),
      new Promise((r) => other.close(r)),
    ]);
  });

  it('refuses a redirect to another host', async () => {
    handler = (_req, res) => {
      res.writeHead(302, { location: `${otherBase}/secret` });
      res.end();
    };
    await expect(
      new UrlSource(`${base}/run/`).readImage('img.png'),
    ).rejects.toThrow(/redirected to another host/);
  });

  it('follows a redirect within the same host', async () => {
    handler = (req, res) => {
      if (req.url === '/run/img.png') {
        res.writeHead(302, { location: '/moved/img.png' });
        res.end();
      } else {
        res.end('image');
      }
    };
    const bytes = await new UrlSource(`${base}/run/`).readImage('img.png');
    expect(bytes.toString()).toBe('image');
  });

  it('refuses a body larger than the limit without reading it all', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-length': String(64 * 1024 * 1024) });
      res.write(Buffer.alloc(1024));
      // The body is never finished: the reader must give up on its own.
    };
    await expect(
      new UrlSource(`${base}/run/`).readImage('img.png'),
    ).rejects.toThrow(/larger than/);
  });
});
