import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const FALLBACK_MIME_TYPE = 'application/octet-stream';
const DEFAULT_INDEX_FILE = 'index.html';

export type RequestHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => Promise<void>;

function send(
  res: http.ServerResponse,
  status: number,
  contentType: string,
  body: string | Buffer,
): void {
  res.writeHead(status, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

const sendText = (res: http.ServerResponse, status: number, text: string) =>
  send(res, status, 'text/plain; charset=utf-8', text);

function isInside(root: string, target: string): boolean {
  return target === root || target.startsWith(root + path.sep);
}

/**
 * Creates a request listener that serves files from a directory. Requests for
 * a directory are answered with its index file. Paths are checked both
 * lexically and after resolving symlinks, so nothing outside the root is ever
 * readable (AGENTS.md rule 6).
 */
export function createStaticHandler(options: {
  root: string;
  indexFile?: string;
}): RequestHandler {
  const root = path.resolve(options.root);
  const indexFile = options.indexFile ?? DEFAULT_INDEX_FILE;

  return async (req, res) => {
    try {
      const [rawPath = '/'] = (req.url || '/').split(/[?#]/);
      let decoded: string;
      try {
        decoded = decodeURIComponent(rawPath);
      } catch {
        sendText(res, 403, 'Forbidden');
        return;
      }

      let target = path.resolve(root, `.${decoded}`);
      if (!isInside(root, target)) {
        sendText(res, 403, 'Forbidden');
        return;
      }

      const stat = await fs.stat(target).catch(() => undefined);
      if (stat?.isDirectory()) {
        target = path.join(target, indexFile);
      }

      let realTarget: string;
      try {
        realTarget = await fs.realpath(target);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          sendText(res, 404, 'Not found');
          return;
        }
        throw err;
      }
      const realRoot = await fs.realpath(root).catch(() => root);
      if (!isInside(realRoot, realTarget)) {
        sendText(res, 403, 'Forbidden');
        return;
      }

      send(
        res,
        200,
        MIME_TYPES[path.extname(target).toLowerCase()] ?? FALLBACK_MIME_TYPE,
        await fs.readFile(target),
      );
    } catch {
      sendText(res, 404, 'Not found');
    }
  };
}

/** Normalizes the address a server listens on into a clean HTTP URL. */
export function formatServerUrl(server: http.Server): string {
  const addr = server.address();
  if (!addr || typeof addr !== 'object') {
    return 'http://127.0.0.1';
  }
  const host =
    addr.family === 'IPv6' && addr.address === '::1'
      ? '[::1]'
      : addr.address === '::' || addr.address === '0.0.0.0'
        ? '127.0.0.1'
        : addr.address;
  return `http://${host}:${addr.port}`;
}

export interface StaticServer {
  server: http.Server;
  url: string;
  port: number;
  handler: RequestHandler;
  stop: () => Promise<void>;
}

/** Serves a directory on the given port, or a free one when none is given. */
export async function startStaticServer(options: {
  root: string;
  indexFile?: string;
  port?: number;
}): Promise<StaticServer> {
  const handler = createStaticHandler(options);
  const server = http.createServer(handler);
  const requestedPort = options.port ?? 0;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, () => resolve());
  });

  const address = server.address() as AddressInfo | null;
  return {
    server,
    handler,
    url: formatServerUrl(server),
    port: address?.port ?? requestedPort,
    stop: () => stopServer(server),
  };
}

/** Closes a server, force-closing keep-alive connections so it never hangs. */
export async function stopServer(
  server: http.Server | null | undefined,
): Promise<void> {
  if (!server) return;
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}
