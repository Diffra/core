import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  StorageAdapter,
  TestRunReport,
  Viewport,
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

  constructor(options: LocalStorageOptions = {}) {
    const cwd = options.cwd || process.cwd();
    const out = options.outputDir || '.diffra';
    const base = options.baselineDir || '.diffra/baselines';
    this.outputDir = path.isAbsolute(out) ? out : path.resolve(cwd, out);
    this.baselineDir = path.isAbsolute(base) ? base : path.resolve(cwd, base);
  }

  async init(): Promise<void> {
    await fs.mkdir(this.baselineDir, { recursive: true });
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  private getFilename(storyId: string, viewport: Viewport): string {
    return `${storyId.replace(/[^a-zA-Z0-9_-]/g, '_')}--${viewport.width}x${viewport.height}.png`;
  }

  async uploadCandidate(
    runId: string,
    storyId: string,
    viewport: Viewport,
    imageBuffer: Buffer,
  ): Promise<string> {
    const dir = path.join(this.outputDir, 'runs', runId, 'candidates');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, this.getFilename(storyId, viewport));
    await fs.writeFile(filePath, imageBuffer);
    return filePath;
  }

  async uploadDiff(
    runId: string,
    storyId: string,
    viewport: Viewport,
    imageBuffer: Buffer,
  ): Promise<string> {
    const dir = path.join(this.outputDir, 'runs', runId, 'diffs');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, this.getFilename(storyId, viewport));
    await fs.writeFile(filePath, imageBuffer);
    return filePath;
  }

  async downloadBaseline(
    baselineCommit: string,
    storyId: string,
    viewport: Viewport,
  ): Promise<Buffer | null> {
    const commitPath = path.join(
      this.baselineDir,
      baselineCommit,
      this.getFilename(storyId, viewport),
    );
    try {
      return await fs.readFile(commitPath);
    } catch {
      const defaultPath = path.join(
        this.baselineDir,
        this.getFilename(storyId, viewport),
      );
      try {
        return await fs.readFile(defaultPath);
      } catch {
        return null;
      }
    }
  }

  async uploadBaseline(
    commitSha: string,
    storyId: string,
    viewport: Viewport,
    imageBuffer: Buffer,
  ): Promise<void> {
    const filename = this.getFilename(storyId, viewport);
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
