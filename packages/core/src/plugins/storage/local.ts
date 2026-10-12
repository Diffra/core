import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  SnapshotKey,
  StorageAdapter,
  TestRunReport,
} from '../../types/index.js';

export interface LocalStorageOptions {
  outputDir?: string;
  baselineDir?: string;
  cwd?: string;
}

export class LocalFilesystemAdapter implements StorageAdapter {
  name = 'local';
  private baselineDir: string;
  private outputDir: string;
  private blobsDir: string;

  constructor(options: LocalStorageOptions = {}) {
    const cwd = options.cwd || process.cwd();
    const out = options.outputDir || '.diffra';
    const base = options.baselineDir || '.diffra/baselines';
    this.outputDir = path.isAbsolute(out) ? out : path.resolve(cwd, out);
    this.baselineDir = path.isAbsolute(base) ? base : path.resolve(cwd, base);
    this.blobsDir = path.join(this.outputDir, 'blobs');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.baselineDir, { recursive: true });
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.blobsDir, { recursive: true });
  }

  private assertWithinBoundary(
    targetPath: string,
    baseDir: string,
    context: string,
  ): void {
    const resolved = path.resolve(targetPath);
    const resolvedBase = path.resolve(baseDir);
    if (
      resolved !== resolvedBase &&
      !resolved.startsWith(resolvedBase + path.sep)
    ) {
      throw new Error(
        `Security Error: Path traversal attempt detected in ${context}: "${targetPath}" resolves outside base directory "${baseDir}"`,
      );
    }
  }

  private getFilename(key: SnapshotKey, includeBrowser = true): string {
    const safeTargetId = key.targetId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeBrowser =
      includeBrowser && key.browser
        ? `--${key.browser.replace(/[^a-zA-Z0-9_-]/g, '_')}`
        : '';
    return `${safeTargetId}${safeBrowser}--${key.viewport.width}x${key.viewport.height}.png`;
  }

  async uploadBlob(hash: string, imageBuffer: Buffer): Promise<string> {
    const rawBlobPath = path.join(this.blobsDir, `${hash}.png`);
    this.assertWithinBoundary(rawBlobPath, this.blobsDir, 'uploadBlob');

    const safeHash = hash.replace(/[^a-zA-Z0-9_-]/g, '_');
    const blobPath = path.join(this.blobsDir, `${safeHash}.png`);

    await fs.mkdir(this.blobsDir, { recursive: true });
    try {
      await fs.access(blobPath);
    } catch {
      await fs.writeFile(blobPath, imageBuffer);
    }
    return blobPath;
  }

  async downloadBlob(hash: string): Promise<Buffer | null> {
    const rawBlobPath = path.join(this.blobsDir, `${hash}.png`);
    this.assertWithinBoundary(rawBlobPath, this.blobsDir, 'downloadBlob');

    const safeHash = hash.replace(/[^a-zA-Z0-9_-]/g, '_');
    const blobPath = path.join(this.blobsDir, `${safeHash}.png`);

    try {
      return await fs.readFile(blobPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async hasBlob(hash: string): Promise<boolean> {
    const rawBlobPath = path.join(this.blobsDir, `${hash}.png`);
    this.assertWithinBoundary(rawBlobPath, this.blobsDir, 'hasBlob');

    const safeHash = hash.replace(/[^a-zA-Z0-9_-]/g, '_');
    const blobPath = path.join(this.blobsDir, `${safeHash}.png`);

    try {
      await fs.access(blobPath);
      return true;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }

  async uploadCandidate(
    runId: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<string> {
    const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    await this.uploadBlob(hash, imageBuffer);

    const dir = path.join(this.outputDir, 'runs', runId, 'candidates');
    const filePath = path.join(dir, this.getFilename(key));
    this.assertWithinBoundary(filePath, this.outputDir, 'uploadCandidate');

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, imageBuffer);
    return filePath;
  }

  async uploadDiff(
    runId: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<string> {
    const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    await this.uploadBlob(hash, imageBuffer);

    const dir = path.join(this.outputDir, 'runs', runId, 'diffs');
    const filePath = path.join(dir, this.getFilename(key));
    this.assertWithinBoundary(filePath, this.outputDir, 'uploadDiff');

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, imageBuffer);
    return filePath;
  }

  async downloadBaseline(
    baselineCommit: string,
    key: SnapshotKey,
  ): Promise<Buffer | null> {
    const filename = this.getFilename(key, true);
    const commitPath = path.join(this.baselineDir, baselineCommit, filename);
    this.assertWithinBoundary(commitPath, this.baselineDir, 'downloadBaseline');

    // 1. Try commit-specific baseline with browser suffix
    try {
      return await fs.readFile(commitPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    // 2. Try default baseline with browser suffix
    const defaultPath = path.join(this.baselineDir, filename);
    this.assertWithinBoundary(
      defaultPath,
      this.baselineDir,
      'downloadBaseline',
    );
    try {
      return await fs.readFile(defaultPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    // 3. Fallback: If browser was specified, try without browser suffix
    if (key.browser) {
      const fallbackFilename = this.getFilename(key, false);
      const fallbackCommitPath = path.join(
        this.baselineDir,
        baselineCommit,
        fallbackFilename,
      );
      this.assertWithinBoundary(
        fallbackCommitPath,
        this.baselineDir,
        'downloadBaseline',
      );
      try {
        return await fs.readFile(fallbackCommitPath);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
      }

      const fallbackDefaultPath = path.join(this.baselineDir, fallbackFilename);
      this.assertWithinBoundary(
        fallbackDefaultPath,
        this.baselineDir,
        'downloadBaseline',
      );
      try {
        return await fs.readFile(fallbackDefaultPath);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
      }
    }

    return null;
  }

  async uploadBaseline(
    commitSha: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<void> {
    const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    await this.uploadBlob(hash, imageBuffer);

    const filename = this.getFilename(key);
    const defaultPath = path.join(this.baselineDir, filename);
    this.assertWithinBoundary(defaultPath, this.baselineDir, 'uploadBaseline');
    await fs.writeFile(defaultPath, imageBuffer);

    const commitDir = path.join(this.baselineDir, commitSha);
    const commitPath = path.join(commitDir, filename);
    this.assertWithinBoundary(commitPath, this.baselineDir, 'uploadBaseline');

    await fs.mkdir(commitDir, { recursive: true });
    await fs.writeFile(commitPath, imageBuffer);
  }

  async saveReport(report: TestRunReport): Promise<string> {
    const runDir = path.join(this.outputDir, 'runs', report.runId);
    const reportPath = path.join(runDir, 'report.json');
    this.assertWithinBoundary(reportPath, this.outputDir, 'saveReport');

    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    const latestPath = path.join(this.outputDir, 'latest-report.json');
    this.assertWithinBoundary(latestPath, this.outputDir, 'saveReport');
    await fs.writeFile(latestPath, JSON.stringify(report, null, 2), 'utf-8');
    return reportPath;
  }
}

export function createLocalStorage(
  options?: LocalStorageOptions,
): StorageAdapter {
  return new LocalFilesystemAdapter(options);
}
