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

interface S3ClientLike {
  send: (cmd: unknown) => Promise<{ Body?: AsyncIterable<Uint8Array> }>;
}

export class S3StorageAdapter implements StorageAdapter {
  name = 's3';
  private bucket: string;
  private prefix: string;
  private region: string;
  private endpoint?: string;
  private s3Client: S3ClientLike | null = null;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.prefix = options.prefix || 'diffra';
    this.region = options.region || 'us-east-1';
    this.endpoint = options.endpoint;
  }

  async init(): Promise<void> {
    // @ts-expect-error
    const { S3Client } = await import('@aws-sdk/client-s3');
    this.s3Client = new S3Client({
      region: this.region,
      ...(this.endpoint ? { endpoint: this.endpoint } : {}),
    });
  }

  private getClient(): S3ClientLike {
    if (!this.s3Client) {
      throw new Error('S3 Storage not initialized');
    }
    return this.s3Client;
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
    // @ts-expect-error
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const objectKey = `${this.prefix}/runs/${runId}/candidates/${this.getFilename(key)}`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: imageBuffer,
        ContentType: 'image/png',
      }),
    );
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${objectKey}`;
  }

  async uploadDiff(
    runId: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<string> {
    // @ts-expect-error
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const objectKey = `${this.prefix}/runs/${runId}/diffs/${this.getFilename(key)}`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: imageBuffer,
        ContentType: 'image/png',
      }),
    );
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${objectKey}`;
  }

  async downloadBaseline(
    baselineCommit: string,
    key: SnapshotKey,
  ): Promise<Buffer | null> {
    // @ts-expect-error
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
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
        for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  async uploadBaseline(
    commitSha: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<void> {
    // @ts-expect-error
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
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
    // @ts-expect-error
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const key = `${this.prefix}/runs/${report.runId}/report.json`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: JSON.stringify(report, null, 2),
        ContentType: 'application/json',
      }),
    );
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

export function createS3Storage(options: S3StorageOptions): StorageAdapter {
  return new S3StorageAdapter(options);
}
