import type {
  SnapshotKey,
  StorageAdapter,
  TestRunReport,
} from '../../types/index.js';

export interface GCSStorageOptions {
  bucket: string;
  prefix?: string;
}

interface GCSFileLike {
  save: (data: Buffer | string, options?: unknown) => Promise<void>;
  download: () => Promise<[Buffer]>;
  name: string;
}

interface GCSBucketLike {
  file: (name: string) => GCSFileLike;
}

interface GCSStorageLike {
  bucket: (name: string) => GCSBucketLike;
}

export class GCSStorageAdapter implements StorageAdapter {
  name = 'gcs';
  private bucket: string;
  private prefix: string;
  private gcsStorage: GCSStorageLike | null = null;

  constructor(options: GCSStorageOptions) {
    this.bucket = options.bucket;
    this.prefix = options.prefix || 'diffra';
  }

  async init(): Promise<void> {
    // @ts-expect-error
    const { Storage } = await import('@google-cloud/storage');
    this.gcsStorage = new Storage();
  }

  private getClient(): GCSStorageLike {
    if (!this.gcsStorage) {
      throw new Error('GCS storage adapter not initialized');
    }
    return this.gcsStorage;
  }

  private getFilename(key: SnapshotKey): string {
    const browserSuffix = key.browser ? `--${key.browser}` : '';
    return `${key.targetId.replace(/[^a-zA-Z0-9_-]/g, '_')}${browserSuffix}--${key.viewport.width}x${key.viewport.height}.png`;
  }

  async uploadCandidate(
    runId: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<string> {
    const file = this.getClient()
      .bucket(this.bucket)
      .file(
        `${this.prefix}/runs/${runId}/candidates/${this.getFilename(key)}`,
      );
    await file.save(imageBuffer, { contentType: 'image/png' });
    return `https://storage.googleapis.com/${this.bucket}/${file.name}`;
  }

  async uploadDiff(
    runId: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<string> {
    const file = this.getClient()
      .bucket(this.bucket)
      .file(
        `${this.prefix}/runs/${runId}/diffs/${this.getFilename(key)}`,
      );
    await file.save(imageBuffer, { contentType: 'image/png' });
    return `https://storage.googleapis.com/${this.bucket}/${file.name}`;
  }

  async downloadBaseline(
    baselineCommit: string,
    key: SnapshotKey,
  ): Promise<Buffer | null> {
    const file = this.getClient()
      .bucket(this.bucket)
      .file(
        `${this.prefix}/baselines/${baselineCommit}/${this.getFilename(key)}`,
      );
    try {
      const [contents] = await file.download();
      return contents;
    } catch {
      return null;
    }
  }

  async uploadBaseline(
    commitSha: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<void> {
    const file = this.getClient()
      .bucket(this.bucket)
      .file(
        `${this.prefix}/baselines/${commitSha}/${this.getFilename(key)}`,
      );
    await file.save(imageBuffer, { contentType: 'image/png' });
  }

  async saveReport(report: TestRunReport): Promise<string> {
    const file = this.getClient()
      .bucket(this.bucket)
      .file(`${this.prefix}/runs/${report.runId}/report.json`);
    await file.save(JSON.stringify(report, null, 2), {
      contentType: 'application/json',
    });
    return `https://storage.googleapis.com/${this.bucket}/${file.name}`;
  }
}

export function createGCSStorage(options: GCSStorageOptions): StorageAdapter {
  return new GCSStorageAdapter(options);
}
