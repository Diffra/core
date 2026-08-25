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

  private getFilename(key: SnapshotKey): string {
    const browserSuffix = key.browser ? `--${key.browser}` : '';
    return `${key.targetId.replace(/[^a-zA-Z0-9_-]/g, '_')}${browserSuffix}--${key.viewport.width}x${key.viewport.height}.png`;
  }

  async uploadBlob(hash: string, imageBuffer: Buffer): Promise<string> {
    await fs.mkdir(this.blobsDir, { recursive: true });
    const blobPath = path.join(this.blobsDir, `${hash}.png`);
    try {
      await fs.access(blobPath);
    } catch {
      await fs.writeFile(blobPath, imageBuffer);
    }
    return blobPath;
  }

  async downloadBlob(hash: string): Promise<Buffer | null> {
    const blobPath = path.join(this.blobsDir, `${hash}.png`);
    try {
      return await fs.readFile(blobPath);
    } catch {
      return null;
    }
  }

  async hasBlob(hash: string): Promise<boolean> {
    const blobPath = path.join(this.blobsDir, `${hash}.png`);
    try {
      await fs.access(blobPath);
      return true;
    } catch {
      return false;
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
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, this.getFilename(key));
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
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, this.getFilename(key));
    await fs.writeFile(filePath, imageBuffer);
    return filePath;
  }

  async downloadBaseline(
    baselineCommit: string,
    key: SnapshotKey,
  ): Promise<Buffer | null> {
    const filename = this.getFilename(key);
    const commitPath = path.join(this.baselineDir, baselineCommit, filename);
    try {
      return await fs.readFile(commitPath);
    } catch {
      const defaultPath = path.join(this.baselineDir, filename);
      try {
        return await fs.readFile(defaultPath);
      } catch {
        return null;
      }
    }
  }

  async uploadBaseline(
    commitSha: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<void> {
    const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    await this.uploadBlob(hash, imageBuffer);

    const filename = this.getFilename(key);
    await fs.writeFile(path.join(this.baselineDir, filename), imageBuffer);
    const commitDir = path.join(this.baselineDir, commitSha);
    await fs.mkdir(commitDir, { recursive: true });
    await fs.writeFile(path.join(commitDir, filename), imageBuffer);
  }

  async saveReport(report: TestRunReport): Promise<string> {
    const runDir = path.join(this.outputDir, 'runs', report.runId);
    await fs.mkdir(runDir, { recursive: true });
    const reportPath = path.join(runDir, 'report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    const latestPath = path.join(this.outputDir, 'latest-report.json');
    await fs.writeFile(latestPath, JSON.stringify(report, null, 2), 'utf-8');
    return reportPath;
  }
}

export function createLocalStorage(
  options?: LocalStorageOptions,
): StorageAdapter {
  return new LocalFilesystemAdapter(options);
}
