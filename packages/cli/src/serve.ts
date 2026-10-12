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
};

export interface ServeOptions {
  reportPath?: string;
  outputDir?: string;
  port?: number;
}

export interface ServeInstance {
  server: http.Server;
  url: string;
  port: number;
  stop: () => Promise<void>;
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => Promise<void>;
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
 * Creates an HTTP request listener for diffra serve with strict path traversal protection.
 */
export function createServeHandler(options: {
  reportPath: string;
  staticRoot: string;
}): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> {
  const resolvedReport = path.resolve(options.reportPath);
  const resolvedRoot = path.resolve(options.staticRoot);

  return async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> => {
    try {
      const rawUrl = req.url || '/';
      const pathPart = rawUrl.split('?')[0].split('#')[0];
      let decodedPath = '/';
      try {
        decodedPath = decodeURIComponent(pathPart);
      } catch {
        res.writeHead(403, {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end('Forbidden');
        return;
      }

      // 1. Root / index.html serving
      if (decodedPath === '/' || decodedPath === '/index.html') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Diffra Visual Review</title>
</head>
<body>
  <diffra-viewer data-report-url="./report.json"></diffra-viewer>
</body>
</html>`);
        return;
      }

      // 2. Report JSON manifest route
      if (
        decodedPath === '/report.json' ||
        decodedPath === '/api/report' ||
        decodedPath === '/latest-report.json'
      ) {
        try {
          const content = await fs.readFile(resolvedReport, 'utf-8');
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(content);
          return;
        } catch {
          res.writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end('Report not found');
          return;
        }
      }

      // 3. Static asset serving with path traversal boundary validation
      const safePath = path.resolve(resolvedRoot, `.${decodedPath}`);
      if (
        safePath !== resolvedRoot &&
        !safePath.startsWith(resolvedRoot + path.sep)
      ) {
        res.writeHead(403, {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end('Forbidden');
        return;
      }

      // Symlink canonical realpath boundary validation per AGENTS.md Rule 6
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
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end('Forbidden');
          return;
        }
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          res.writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8',
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
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end('Not found');
    }
  };
}

/**
 * Starts a zero-dependency static preview server on dynamic port 0 (or configured port).
 */
export async function startServeServer(
  options: ServeOptions = {},
): Promise<ServeInstance> {
  const resolvedReport = path.resolve(
    options.reportPath ||
      path.join(options.outputDir || '.diffra', 'latest-report.json'),
  );
  const staticRoot = options.outputDir
    ? path.resolve(options.outputDir)
    : path.dirname(resolvedReport);

  const handler = createServeHandler({
    reportPath: resolvedReport,
    staticRoot,
  });

  const server = http.createServer(handler);
  const targetPort = typeof options.port === 'number' ? options.port : 0;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(targetPort, () => resolve());
  });

  const addr = server.address() as AddressInfo;
  const port = typeof addr === 'object' && addr ? addr.port : targetPort;
  const url = formatServerUrl(server);

  const stop = async () => {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  };

  return { server, url, port, stop, handler };
}
