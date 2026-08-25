import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  DriverContext,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';

export class StorybookDriver implements VisualDriver {
  name = 'storybook';

  async discover(context: DriverContext): Promise<VisualTarget[]> {
    const cwd = context.cwd || process.cwd();
    const config = context.config;
    const baseUrl =
      config.baseUrl || config.previewUrl || config.storybookUrl || 'http://localhost:6006';

    // 1. Try reading index.json / stories.json from pre-built directory if available
    const buildDirCandidate =
      config.storybookBuildDir || 'storybook-static';
    const staticDirPath = path.resolve(cwd, buildDirCandidate);

    for (const indexFileName of ['index.json', 'stories.json']) {
      try {
        const indexPath = path.join(staticDirPath, indexFileName);
        const exists = await fs.stat(indexPath).catch(() => null);
        if (exists?.isFile()) {
          const content = await fs.readFile(indexPath, 'utf-8');
          const data = JSON.parse(content);
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
          const res = await fetch(indexUrl, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = (await res.json()) as any;
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

  private parseStoryIndex(data: any, baseUrl: string): VisualTarget[] {
    const rawEntries = data.entries || data.stories || {};
    const entriesList = Array.isArray(rawEntries)
      ? rawEntries
      : Object.values(rawEntries);

    const targets: VisualTarget[] = [];

    for (const entry of entriesList as any[]) {
      // Exclude docs-only entries unless they represent testable story components
      if (entry.type && entry.type !== 'story') {
        continue;
      }

      const id = entry.id;
      if (!id) continue;

      const title = entry.title || entry.name || 'Component';
      const cleanComponent = title.split('/').pop() || title;
      const name = entry.name || entry.story || 'Default';
      const parameters = entry.parameters || {};

      // Check if snapshot is disabled
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
        component: cleanComponent,
        title,
        filePath: entry.importPath,
        parameters,
        url: baseUrl
          ? `${baseUrl.replace(/\/$/, '')}/iframe.html?id=${encodeURIComponent(
              id,
            )}&viewMode=story`
          : undefined,
        selector:
          snapshotParams.selector || '#storybook-root, #root',
      });
    }

    return targets;
  }
}

export function createStorybookDriver(): VisualDriver {
  return new StorybookDriver();
}
