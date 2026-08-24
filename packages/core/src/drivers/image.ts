import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  DriverCaptureResult,
  DriverCaptureTask,
  DriverContext,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';

export class ImageDriver implements VisualDriver {
  name = 'image';

  async discover(context: DriverContext): Promise<VisualTarget[]> {
    const { config, cwd } = context;
    const imagesDir = path.resolve(
      cwd || process.cwd(),
      config.imagesDir || 'screenshots',
    );
    const targets: VisualTarget[] = [];

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
          await scan(fullPath);
        } else if (
          entry.isFile() &&
          /\.(png|jpg|jpeg|webp)$/i.test(entry.name)
        ) {
          const relPath = path.relative(imagesDir, fullPath);
          const ext = path.extname(entry.name);
          const baseName = path.basename(entry.name, ext);
          const groupName =
            path.dirname(relPath) === '.' ? 'Images' : path.dirname(relPath);

          const id = `image--${relPath.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`;

          targets.push({
            id,
            name: baseName,
            group: groupName,
            component: groupName,
            title: groupName,
            filePath: fullPath,
            metadata: {
              imagePath: fullPath,
            },
          });
        }
      }
    }

    await scan(imagesDir);
    return targets;
  }

  async capture(
    task: DriverCaptureTask,
    _context: DriverContext,
  ): Promise<Buffer | null> {
    const imgPath =
      (task.target.metadata?.imagePath as string) || task.target.filePath;
    if (!imgPath) return null;

    try {
      return await fs.readFile(imgPath);
    } catch {
      return null;
    }
  }

  async captureAll(
    tasks: DriverCaptureTask[],
    context: DriverContext,
  ): Promise<DriverCaptureResult[]> {
    const results: DriverCaptureResult[] = [];
    for (const task of tasks) {
      const buffer = await this.capture(task, context);
      if (buffer) {
        results.push({
          target: task.target,
          viewport: task.viewport,
          buffer,
        });
      }
    }
    return results;
  }
}

export function createImageDriver(): VisualDriver {
  return new ImageDriver();
}
