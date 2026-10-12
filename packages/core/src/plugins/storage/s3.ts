import type { S3Client } from '@aws-sdk/client-s3';
import type {
  SnapshotKey,
  StorageAdapter,
  TestRunReport,
} from '../../types/index.js';

export interface S3StorageOptions {
  bucket: string;
  prefix?: string;
  region?: string;
  endpoint?: string;
}

function isS3NotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e.name === 'NoSuchKey' ||
    e.name === 'NotFound' ||
    e.Code === 'NoSuchKey' ||
    e.$metadata?.httpStatusCode === 404
  );
}

export class S3StorageAdapter implements StorageAdapter {
  name = 's3';
  private bucket: string;
  private prefix: string;
  private region: string;
  private endpoint?: string;
  private s3Client: S3Client | null = null;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.prefix = options.prefix || 'diffra';
    this.region = options.region || 'us-east-1';
    this.endpoint = options.endpoint;
  }

  async init(): Promise<void> {
    const { S3Client } = await import('@aws-sdk/client-s3');
    this.s3Client = new S3Client({
      region: this.region,
      ...(this.endpoint ? { endpoint: this.endpoint } : {}),
    });
  }

  private getClient(): S3Client {
    if (!this.s3Client) {
      throw new Error('S3 Storage not initialized');
    }
    return this.s3Client;
  }

  private formatUrl(objectKey: string): string {
    if (this.endpoint) {
      const base = this.endpoint.replace(/\/+$/, '');
      return `${base}/${this.bucket}/${objectKey}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${objectKey}`;
  }

  private getFilename(key: SnapshotKey): string {
    const browserSuffix = key.browser
      ? `--${key.browser.replace(/[^a-zA-Z0-9_-]/g, '_')}`
      : '';
    return `${key.targetId.replace(/[^a-zA-Z0-9_-]/g, '_')}${browserSuffix}--${key.viewport.width}x${key.viewport.height}.png`;
  }

  private async getCommands() {
    try {
      return await import('@aws-sdk/client-s3');
    } catch {
      return {
        PutObjectCommand: class PutObjectCommand {
          constructor(public input: unknown) {}
        },
        GetObjectCommand: class GetObjectCommand {
          constructor(public input: unknown) {}
        },
        HeadObjectCommand: class HeadObjectCommand {
          constructor(public input: unknown) {}
        },
      };
    }
  }

  async uploadBlob(hash: string, buffer: Buffer): Promise<string> {
    const { PutObjectCommand } = await this.getCommands();
    const objectKey = `${this.prefix}/blobs/${hash}.png`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: 'image/png',
      }),
    );
    return this.formatUrl(objectKey);
  }

  async downloadBlob(hash: string): Promise<Buffer | null> {
    if (!this.s3Client) return null;
    const { GetObjectCommand } = await this.getCommands();
    const objectKey = `${this.prefix}/blobs/${hash}.png`;
    try {
      const response = await this.getClient().send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );
      const chunks: Uint8Array[] = [];
      if (response.Body) {
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
      }
      return Buffer.concat(chunks);
    } catch (err: unknown) {
      if (isS3NotFound(err)) {
        return null;
      }
      throw err;
    }
  }

  async hasBlob(hash: string): Promise<boolean> {
    if (!this.s3Client) return false;
    const { HeadObjectCommand } = await this.getCommands();
    const objectKey = `${this.prefix}/blobs/${hash}.png`;
    try {
      await this.getClient().send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );
      return true;
    } catch (err: unknown) {
      if (isS3NotFound(err)) {
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
    const { PutObjectCommand } = await this.getCommands();
    const objectKey = `${this.prefix}/runs/${runId}/candidates/${this.getFilename(key)}`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: imageBuffer,
        ContentType: 'image/png',
      }),
    );
    return this.formatUrl(objectKey);
  }

  async uploadDiff(
    runId: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<string> {
    const { PutObjectCommand } = await this.getCommands();
    const objectKey = `${this.prefix}/runs/${runId}/diffs/${this.getFilename(key)}`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: imageBuffer,
        ContentType: 'image/png',
      }),
    );
    return this.formatUrl(objectKey);
  }

  async downloadBaseline(
    baselineCommit: string,
    key: SnapshotKey,
  ): Promise<Buffer | null> {
    if (!this.s3Client) {
      return null;
    }
    const { GetObjectCommand } = await this.getCommands();
    const objectKey = `${this.prefix}/baselines/${baselineCommit}/${this.getFilename(key)}`;
    try {
      const response = await this.getClient().send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );
      const chunks: Uint8Array[] = [];
      if (response.Body) {
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
      }
      return Buffer.concat(chunks);
    } catch (err: unknown) {
      if (isS3NotFound(err)) {
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
    const { PutObjectCommand } = await this.getCommands();
    const objectKey = `${this.prefix}/baselines/${commitSha}/${this.getFilename(key)}`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: imageBuffer,
        ContentType: 'image/png',
      }),
    );
  }

  async saveReport(report: TestRunReport): Promise<string> {
    const { PutObjectCommand } = await this.getCommands();
    const key = `${this.prefix}/runs/${report.runId}/report.json`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: JSON.stringify(report, null, 2),
        ContentType: 'application/json',
      }),
    );
    return this.formatUrl(key);
  }
}

export function createS3Storage(options: S3StorageOptions): StorageAdapter {
  return new S3StorageAdapter(options);
}
