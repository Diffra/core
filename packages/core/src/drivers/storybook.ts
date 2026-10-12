import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type {
  DriverContext,
  TargetParameters,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';

export interface StorybookEntry {
  id?: string;
  name?: string;
  title?: string;
  story?: string;
  importPath?: string;
  type?: string;
  parameters?: {
    snapshot?: TargetParameters;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface StorybookIndexData {
  v?: number;
  entries?: Record<string, StorybookEntry> | StorybookEntry[];
  stories?: Record<string, StorybookEntry> | StorybookEntry[];
  [key: string]: unknown;
}

export class StorybookDriver implements VisualDriver {
  name = 'storybook';
  private url?: string;
  private buildDir?: string;
  private server?: http.Server;
  private serverUrl?: string;

  constructor(options?: { url?: string; buildDir?: string }) {
    this.url = options?.url;
    this.buildDir = options?.buildDir;
  }

  public getServer(): http.Server | undefined {
    return this.server;
  }

  async startStaticServer(buildDir: string): Promise<string> {
    if (this.server && this.serverUrl) {
      return this.serverUrl;
    }

    const resolvedStaticDir = path.resolve(buildDir);

    const server = http.createServer(async (req, res) => {
      const rawUrl = req.url || '/';
      let rawPath = rawUrl.split('?')[0];
      try {
        rawPath = decodeURIComponent(rawPath);
      } catch {}
      let reqPath = rawPath;
      if (reqPath === '/' || reqPath === '') {
        reqPath = '/index.html';
      }

      const filePath = path.resolve(resolvedStaticDir, `.${reqPath}`);

      // Path traversal boundary validation per AGENTS.md Rule 6
      if (
        filePath !== resolvedStaticDir &&
        !filePath.startsWith(resolvedStaticDir + path.sep)
      ) {
        res.writeHead(403, {
          'Content-Type': 'text/plain',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end('Forbidden');
        return;
      }

      try {
        const stat = await fs.stat(filePath);
        let targetFilePath = filePath;
        if (stat.isDirectory()) {
          targetFilePath = path.join(filePath, 'index.html');
          const indexStat = await fs.stat(targetFilePath).catch(() => null);
          if (!indexStat?.isFile()) {
            res.writeHead(404, {
              'Content-Type': 'text/plain',
              'X-Content-Type-Options': 'nosniff',
            });
            res.end('Not Found');
            return;
          }
        }

        const ext = path.extname(targetFilePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.mjs': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ico': 'image/x-icon',
          '.txt': 'text/plain; charset=utf-8',
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const content = await fs.readFile(targetFilePath);

        res.writeHead(200, {
          'Content-Type': contentType,
          'X-Content-Type-Options': 'nosniff',
          'Content-Length': content.length,
        });
        res.end(content);
      } catch {
        res.writeHead(404, {
          'Content-Type': 'text/plain',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve());
      server.on('error', reject);
    });

    const addr = server.address() as AddressInfo;
    const host =
      addr.family === 'IPv6'
        ? `[${addr.address}]`
        : addr.address === '0.0.0.0' || addr.address === '::'
          ? '127.0.0.1'
          : addr.address;
    const allocatedUrl = `http://${host}:${addr.port}`;

    this.server = server;
    this.serverUrl = allocatedUrl;
    return allocatedUrl;
  }

  async teardown(_context?: DriverContext): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = undefined;
      this.serverUrl = undefined;
    }
  }

  async discover(context: DriverContext): Promise<VisualTarget[]> {
    const cwd = context.cwd || process.cwd();
    const driversConfig =
      typeof context.config.drivers === 'object' &&
      context.config.drivers !== null
        ? context.config.drivers
        : undefined;
    let baseUrl =
      this.url ||
      (driversConfig &&
      'url' in driversConfig &&
      typeof driversConfig.url === 'string'
        ? driversConfig.url
        : '');
    const configuredBuildDir =
      driversConfig &&
      'buildDir' in driversConfig &&
      typeof driversConfig.buildDir === 'string'
        ? driversConfig.buildDir
        : undefined;
    const buildDirCandidate =
      this.buildDir ||
      (configuredBuildDir
        ? path.resolve(cwd, configuredBuildDir)
        : path.resolve(cwd, 'storybook-static'));

    // 1. Try reading static index.json / stories.json from build output directory
    for (const fileName of ['index.json', 'stories.json']) {
      const indexPath = path.join(buildDirCandidate, fileName);
      const exists = await fs.stat(indexPath).catch(() => null);
      if (exists?.isFile()) {
        const content = await fs.readFile(indexPath, 'utf-8');
        let data: unknown;
        try {
          data = JSON.parse(content);
        } catch (parseErr) {
          const msg =
            parseErr instanceof Error ? parseErr.message : String(parseErr);
          throw new Error(
            `[diffra] Failed to parse Storybook index file at "${indexPath}": ${msg}`,
          );
        }

        if (!baseUrl) {
          baseUrl = await this.startStaticServer(buildDirCandidate);
          this.url = baseUrl;
        }

        const targets = this.parseStoryIndex(data, baseUrl);
        if (targets.length > 0) {
          return targets;
        }
      }
    }

    // 2. Try fetching index.json / stories.json from running Storybook server
    if (baseUrl) {
      for (const indexEndpoint of ['/index.json', '/stories.json']) {
        try {
          const indexUrl = `${baseUrl.replace(/\/$/, '')}${indexEndpoint}`;
          const res = await fetch(indexUrl, {
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            const data: unknown = await res.json();
            const targets = this.parseStoryIndex(data, baseUrl);
            if (targets.length > 0) {
              return targets;
            }
          }
        } catch {}
      }
    }

    const serverDetail = baseUrl
      ? `running Storybook server (${baseUrl}/index.json)`
      : 'running Storybook server';

    throw new Error(
      `[diffra] Could not discover Storybook stories. Neither a pre-built Storybook directory (${buildDirCandidate}/index.json) nor a ${serverDetail} was found. Please run "storybook build" or start your Storybook server with "storybook dev".`,
    );
  }

  public parseStoryIndex(data: unknown, baseUrl: string): VisualTarget[] {
    if (typeof data !== 'object' || data === null) {
      return [];
    }

    const indexData = data as Record<string, unknown>;
    const rawEntries = indexData.entries || indexData.stories || {};
    const entriesList: StorybookEntry[] = Array.isArray(rawEntries)
      ? (rawEntries as StorybookEntry[])
      : (Object.values(rawEntries) as StorybookEntry[]);

    const targets: VisualTarget[] = [];

    for (const entry of entriesList) {
      if (typeof entry !== 'object' || entry === null) continue;
      if (entry.type && entry.type !== 'story') {
        continue;
      }

      const id = entry.id;
      if (!id) continue;

      const title = entry.title || entry.name || 'Component';
      const cleanComponent = title.split('/').pop() || title;
      const name = entry.name || entry.story || 'Default';
      const parameters = entry.parameters || {};

      const snapshotParams = parameters.snapshot || {};
      if (
        snapshotParams.disableSnapshot === true ||
        snapshotParams.disable === true
      ) {
        continue;
      }

      targets.push({
        id,
        name,
        group: cleanComponent,
        filePath: entry.importPath,
        snapshot: {
          ...snapshotParams,
          selector: snapshotParams.selector || '#storybook-root, #root',
        },
        url: baseUrl
          ? `${baseUrl.replace(/\/$/, '')}/iframe.html?id=${encodeURIComponent(
              id,
            )}&viewMode=story`
          : undefined,
      });
    }

    return targets;
  }
}

export function createStorybookDriver(options?: {
  url?: string;
  buildDir?: string;
}): VisualDriver {
  return new StorybookDriver(options);
}
