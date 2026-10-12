import type { Storage } from '@google-cloud/storage';
import type {
  SnapshotKey,
  StorageAdapter,
  TestRunReport,
} from '../../types/index.js';

export interface GCSStorageOptions {
  bucket: string;
  prefix?: string;
}

function isGCSNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
  return (
    e.code === 404 ||
    Boolean(
      e.message &&
        (e.message.includes('Not Found') ||
          e.message.includes('No such object')),
    ) ||
    e.errors?.[0]?.reason === 'notFound'
  );
}

export class GCSStorageAdapter implements StorageAdapter {
  name = 'gcs';
  private bucket: string;
  private prefix: string;
  private gcsStorage: Storage | null = null;

  constructor(options: GCSStorageOptions) {
    this.bucket = options.bucket;
    this.prefix = options.prefix || 'diffra';
  }

  async init(): Promise<void> {
    const { Storage } = await import('@google-cloud/storage');
    this.gcsStorage = new Storage();
  }

  private getClient(): Storage {
    if (!this.gcsStorage) {
      throw new Error('GCS storage adapter not initialized');
    }
    return this.gcsStorage;
  }

  private getFilename(key: SnapshotKey): string {
    const browserSuffix = key.browser
      ? `--${key.browser.replace(/[^a-zA-Z0-9_-]/g, '_')}`
      : '';
    return `${key.targetId.replace(/[^a-zA-Z0-9_-]/g, '_')}${browserSuffix}--${key.viewport.width}x${key.viewport.height}.png`;
  }

  async uploadBlob(hash: string, buffer: Buffer): Promise<string> {
    const file = this.getClient()
      .bucket(this.bucket)
      .file(`${this.prefix}/blobs/${hash}.png`);
    await file.save(buffer, { contentType: 'image/png' });
    return `https://storage.googleapis.com/${this.bucket}/${file.name}`;
  }

  async downloadBlob(hash: string): Promise<Buffer | null> {
    if (!this.gcsStorage) return null;
    const file = this.getClient()
      .bucket(this.bucket)
      .file(`${this.prefix}/blobs/${hash}.png`);
    try {
      const [contents] = await file.download();
      return contents;
    } catch (err: unknown) {
      if (isGCSNotFound(err)) {
        return null;
      }
      throw err;
    }
  }

  async hasBlob(hash: string): Promise<boolean> {
    if (!this.gcsStorage) return false;
    const file = this.getClient()
      .bucket(this.bucket)
      .file(`${this.prefix}/blobs/${hash}.png`);
    try {
      const [exists] = await file.exists();
      return exists;
    } catch (err: unknown) {
      if (isGCSNotFound(err)) {
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
    const file = this.getClient()
      .bucket(this.bucket)
      .file(`${this.prefix}/runs/${runId}/candidates/${this.getFilename(key)}`);
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
      .file(`${this.prefix}/runs/${runId}/diffs/${this.getFilename(key)}`);
    await file.save(imageBuffer, { contentType: 'image/png' });
    return `https://storage.googleapis.com/${this.bucket}/${file.name}`;
  }

  async downloadBaseline(
    baselineCommit: string,
    key: SnapshotKey,
  ): Promise<Buffer | null> {
    if (!this.gcsStorage) {
      return null;
    }
    const file = this.getClient()
      .bucket(this.bucket)
      .file(
        `${this.prefix}/baselines/${baselineCommit}/${this.getFilename(key)}`,
      );
    try {
      const [contents] = await file.download();
      return contents;
    } catch (err: unknown) {
      if (isGCSNotFound(err)) {
        return null;
      }
      throw err;
    }
  }

  async uploadBaseline(
    commitSha: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<void> {
    const file = this.getClient()
      .bucket(this.bucket)
      .file(`${this.prefix}/baselines/${commitSha}/${this.getFilename(key)}`);
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
