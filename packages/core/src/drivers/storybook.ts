import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCSF } from '../parser/csf-parser.js';
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
    const storyFiles = await this.findStoryFiles(config.stories || [], cwd);
    const targets: VisualTarget[] = [];

    for (const file of storyFiles) {
      try {
        const content = await fs.readFile(path.join(cwd, file), 'utf-8');
        const stories = parseCSF(content, file);
        for (const s of stories) {
          targets.push({
            id: s.id,
            name: s.name,
            group: s.component,
            component: s.component,
            title: s.title,
            filePath: s.filePath,
            parameters: s.parameters,
            url: config.storybookUrl
              ? `${config.storybookUrl.replace(/\/$/, '')}/iframe.html?id=${encodeURIComponent(
                  s.id,
                )}&viewMode=story`
              : undefined,
            selector: '#storybook-root, #root',
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(
          `[diffra] Warning: Could not parse story file ${file}: ${msg}`,
        );
      }
    }

    return targets;
  }

  private async findStoryFiles(
    _patterns: string[],
    cwd: string,
  ): Promise<string[]> {
    const matchedFiles: string[] = [];

    async function scan(dir: string) {
      let entries: import('node:fs').Dirent[] = [];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (
            [
              'node_modules',
              '.git',
              'dist',
              '.diffra',
              'storybook-static',
            ].includes(entry.name)
          ) {
            continue;
          }
          await scan(fullPath);
        } else if (entry.isFile()) {
          if (/\.stories\.(js|jsx|ts|tsx|mjs)$/.test(entry.name)) {
            matchedFiles.push(path.relative(cwd, fullPath));
          }
        }
      }
    }

    await scan(cwd);
    return matchedFiles;
  }
}

export function createStorybookDriver(): VisualDriver {
  return new StorybookDriver();
}
