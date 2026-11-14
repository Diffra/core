import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { BUNDLE_INDEX_FILE, runDirectory } from '@diffra/core';

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

const DEFAULT_OUTPUT_DIR = '.diffra';
const LATEST_REPORT_FILE = 'latest-report.json';

export interface ServeOptions {
  /** A review bundle directory, or the report.json inside one */
  reportPath?: string;
  /** Output directory whose latest run is served when no reportPath is given */
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

function respond(
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

const respondText = (res: http.ServerResponse, status: number, text: string) =>
  respond(res, status, 'text/plain; charset=utf-8', text);

/**
 * Creates an HTTP request listener that serves a review bundle directory, with
 * strict path traversal protection.
 */
export function createServeHandler(options: {
  staticRoot: string;
}): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> {
  const resolvedRoot = path.resolve(options.staticRoot);

  return async (req, res) => {
    try {
      const rawUrl = req.url || '/';
      const [pathPart = '/'] = rawUrl.split(/[?#]/);
      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(pathPart);
      } catch {
        respondText(res, 403, 'Forbidden');
        return;
      }
      if (decodedPath === '/') {
        decodedPath = `/${BUNDLE_INDEX_FILE}`;
      }

      const safePath = path.resolve(resolvedRoot, `.${decodedPath}`);
      if (
        safePath !== resolvedRoot &&
        !safePath.startsWith(resolvedRoot + path.sep)
      ) {
        respondText(res, 403, 'Forbidden');
        return;
      }

      // Symlink canonical realpath boundary validation per AGENTS.md Rule 6
      try {
        const realTarget = await fs.realpath(safePath);
        const realRoot = await fs
          .realpath(resolvedRoot)
          .catch(() => resolvedRoot);
        if (
          realTarget !== realRoot &&
          !realTarget.startsWith(realRoot + path.sep)
        ) {
          respondText(res, 403, 'Forbidden');
          return;
        }
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          respondText(res, 404, 'Not found');
          return;
        }
        throw err;
      }

      const content = await fs.readFile(safePath);
      const contentType =
        MIME_TYPES[path.extname(safePath).toLowerCase()] ||
        'application/octet-stream';
      respond(res, 200, contentType, content);
    } catch {
      respondText(res, 404, 'Not found');
    }
  };
}

/** Finds the review bundle directory to serve. */
export async function resolveBundleDir(
  options: Pick<ServeOptions, 'reportPath' | 'outputDir'>,
): Promise<string> {
  if (options.reportPath) {
    const target = path.resolve(options.reportPath);
    const stat = await fs.stat(target).catch(() => undefined);
    if (!stat) {
      throw new Error(`Report not found: ${target}`);
    }
    return stat.isDirectory() ? target : path.dirname(target);
  }

  const outputDir = path.resolve(options.outputDir || DEFAULT_OUTPUT_DIR);
  const latestFile = path.join(outputDir, LATEST_REPORT_FILE);
  let runId: unknown;
  try {
    runId = (
      JSON.parse(await fs.readFile(latestFile, 'utf-8')) as {
        runId?: unknown;
      }
    ).runId;
  } catch {
    throw new Error(
      `No test run found in ${outputDir}. Run "diffra test" first.`,
    );
  }
  if (typeof runId !== 'string' || !runId) {
    throw new Error(`${latestFile} does not name a run.`);
  }
  return runDirectory(outputDir, runId);
}

/**
 * Starts a zero-dependency static server for a review bundle on a dynamic
 * port (or the configured one).
 */
export async function startServeServer(
  options: ServeOptions = {},
): Promise<ServeInstance> {
  const staticRoot = await resolveBundleDir(options);
  const handler = createServeHandler({ staticRoot });

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
