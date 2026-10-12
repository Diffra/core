import fs from 'node:fs/promises';
import http from 'node:http';
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

/**
 * Creates an HTTP request listener for serving static files with strict path traversal protection.
 */
export function createPreviewHandler(
  staticRoot: string,
): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> {
  const resolvedRoot = path.resolve(staticRoot);

  return async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> => {
    try {
      const rawUrl = req.url || '/';
      const pathPart = rawUrl.split('?')[0].split('#')[0];
      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(pathPart);
      } catch {
        res.writeHead(403, {
          'Content-Type': 'text/plain',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end('Forbidden');
        return;
      }

      // Check if decoded path resolves outside staticRoot
      let safePath = path.resolve(resolvedRoot, `.${decodedPath}`);

      // 1. Lexical boundary verification
      if (
        safePath !== resolvedRoot &&
        !safePath.startsWith(resolvedRoot + path.sep)
      ) {
        res.writeHead(403, {
          'Content-Type': 'text/plain',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end('Forbidden');
        return;
      }

      // Check if target is a directory; if so, resolve to index.html inside it
      try {
        const stat = await fs.stat(safePath);
        if (stat.isDirectory()) {
          safePath = path.join(safePath, 'index.html');
          if (
            safePath !== resolvedRoot &&
            !safePath.startsWith(resolvedRoot + path.sep)
          ) {
            res.writeHead(403, {
              'Content-Type': 'text/plain',
              'X-Content-Type-Options': 'nosniff',
            });
            res.end('Forbidden');
            return;
          }
        }
      } catch {
        // File might not exist; readFile below will handle ENOENT
      }

      // 2. Canonical symlink realpath verification
      try {
        const realTarget = await fs.realpath(safePath);
        let realRoot: string;
        try {
          realRoot = await fs.realpath(resolvedRoot);
        } catch {
          realRoot = resolvedRoot;
        }

        if (
          realTarget !== realRoot &&
          !realTarget.startsWith(realRoot + path.sep)
        ) {
          res.writeHead(403, {
            'Content-Type': 'text/plain',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end('Forbidden');
          return;
        }
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          res.writeHead(404, {
            'Content-Type': 'text/plain',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end('Not found');
          return;
        }
        throw err;
      }

      const content = await fs.readFile(safePath);
      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(content);
    } catch {
      res.writeHead(404, {
        'Content-Type': 'text/plain',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end('Not found');
    }
  };
}

/**
 * Normalizes host and port into a clean HTTP URL using server.address().
 */
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

/**
 * Starts a static preview server on a dynamic port (defaults to port 0).
 */
export async function startPreviewServer(options: {
  root: string;
  port?: number;
}): Promise<{ server: http.Server; url: string; port: number }> {
  const handler = createPreviewHandler(options.root);
  const server = http.createServer(handler);
  const targetPort = typeof options.port === 'number' ? options.port : 0;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(targetPort, () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : targetPort;
  const url = formatServerUrl(server);

  return { server, url, port };
}

/**
 * Clean teardown of static preview server, force-closing open keep-alive connections.
 */
export async function stopPreviewServer(
  server: http.Server | null | undefined,
): Promise<void> {
  if (!server) return;
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}
