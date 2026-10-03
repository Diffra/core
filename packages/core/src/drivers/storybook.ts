import fs from 'node:fs/promises';
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
    visual?: TargetParameters;
    diffra?: TargetParameters;
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

  constructor(options?: { url?: string; buildDir?: string }) {
    this.url = options?.url;
    this.buildDir = options?.buildDir;
  }

  async discover(context: DriverContext): Promise<VisualTarget[]> {
    const cwd = context.cwd || process.cwd();
    const driversConfig =
      typeof context.config.drivers === 'object' &&
      context.config.drivers !== null
        ? context.config.drivers
        : undefined;
    const baseUrl =
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
      try {
        const indexPath = path.join(buildDirCandidate, fileName);
        const exists = await fs.stat(indexPath).catch(() => null);
        if (exists?.isFile()) {
          const content = await fs.readFile(indexPath, 'utf-8');
          const data: unknown = JSON.parse(content);
          const targets = this.parseStoryIndex(data, baseUrl);
          if (targets.length > 0) {
            return targets;
          }
        }
      } catch {}
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

    throw new Error(
      `[diffra] Could not discover Storybook stories. Neither a pre-built Storybook directory (${buildDirCandidate}/index.json) nor a running Storybook server (${baseUrl}/index.json) was found. Please run "storybook build" or start your Storybook server with "storybook dev".`,
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

      const snapshotParams =
        parameters.snapshot || parameters.visual || parameters.diffra || {};
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
