import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  DriverCaptureResult,
  DriverCaptureTask,
  DriverContext,
  ImageDriverConfig,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';

export const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export async function validatePngFile(
  filePath: string,
): Promise<{ valid: boolean; reason?: string }> {
  let fh: import('node:fs/promises').FileHandle | undefined;
  try {
    const stat = await fs.stat(filePath);
    if (stat.size === 0) {
      return { valid: false, reason: 'File is 0 bytes (empty)' };
    }
    if (stat.size < 8) {
      return {
        valid: false,
        reason: 'File size is less than 8-byte PNG header',
      };
    }
    fh = await fs.open(filePath, 'r');
    const header = Buffer.alloc(8);
    const { bytesRead } = await fh.read(header, 0, 8, 0);
    if (bytesRead < 8 || !header.equals(PNG_SIGNATURE)) {
      return { valid: false, reason: 'Invalid PNG magic header' };
    }
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (fh) {
      await fh.close();
    }
  }
}

export interface ImageDriverOptions {
  dir?: string | string[];
  dirs?: string[];
  glob?: string | string[];
  patterns?: string | string[];
  validateFormat?: boolean;
}

export class ImageDriver implements VisualDriver {
  name = 'image';
  private options?: ImageDriverOptions;

  constructor(options?: ImageDriverOptions) {
    this.options = options;
  }

  async discover(context: DriverContext): Promise<VisualTarget[]> {
    const { cwd } = context;
    const rawDirs: string[] = [
      ...(Array.isArray(this.options?.dirs) ? this.options.dirs : []),
      ...(Array.isArray(this.options?.dir)
        ? this.options.dir
        : this.options?.dir
          ? [this.options.dir]
          : []),
    ];
    const targetDirs =
      rawDirs.length > 0 ? Array.from(new Set(rawDirs)) : ['screenshots'];
    const isMultiDir = targetDirs.length > 1;
    const validate = this.options?.validateFormat !== false;
    const targets: VisualTarget[] = [];

    for (const dirItem of targetDirs) {
      const imagesDir = path.resolve(cwd || process.cwd(), dirItem);
      const dirStat = await fs.stat(imagesDir).catch(() => null);
      if (!dirStat?.isDirectory()) {
        console.warn(
          `[diffra] Warning: Image driver directory does not exist: "${imagesDir}"`,
        );
        continue;
      }

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
          } else if (entry.isFile() && /\.png$/i.test(entry.name)) {
            if (validate) {
              const valResult = await validatePngFile(fullPath);
              if (!valResult.valid) {
                console.warn(
                  `[diffra] Warning: Skipping invalid PNG file "${fullPath}": ${valResult.reason}`,
                );
                continue;
              }
            }

            const relPath = path.relative(imagesDir, fullPath);
            const ext = path.extname(entry.name);
            const baseName = path.basename(entry.name, ext);
            const dirName = path.dirname(relPath);

            let groupName = dirName === '.' ? 'Images' : dirName;
            if (isMultiDir) {
              const rootName = path.basename(imagesDir);
              groupName = dirName === '.' ? rootName : `${rootName}/${dirName}`;
            }

            const prefix = isMultiDir ? `${path.basename(imagesDir)}_` : '';
            const id =
              `image--${prefix}${relPath.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`.replace(
                /_{2,}/g,
                '_',
              );

            targets.push({
              id,
              name: baseName,
              group: groupName,
              filePath: fullPath,
              metadata: {
                imagePath: fullPath,
              },
            });
          }
        }
      }

      await scan(imagesDir);
    }

    return targets;
  }

  async capture(
    task: DriverCaptureTask,
    _context: DriverContext,
  ): Promise<Buffer | null> {
    const imgPath =
      (typeof task.target.metadata?.imagePath === 'string'
        ? task.target.metadata.imagePath
        : null) || task.target.filePath;
    if (!imgPath) {
      console.warn(
        `[diffra] Warning: Image target "${task.target.id}" is missing filePath`,
      );
      return null;
    }

    try {
      const buffer = await fs.readFile(imgPath);
      if (buffer.length === 0) {
        console.warn(
          `[diffra] Warning: Image file "${imgPath}" is empty (0 bytes)`,
        );
        return null;
      }
      if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
        console.warn(
          `[diffra] Warning: Image file "${imgPath}" does not have a valid PNG header`,
        );
        return null;
      }
      return buffer;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[diffra] Warning: Failed to read image file "${imgPath}": ${msg}`,
      );
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
      if (buffer && buffer.length > 0) {
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

export function createImageDriver(
  options?: ImageDriverConfig | ImageDriverOptions,
): VisualDriver {
  return new ImageDriver(options);
}
