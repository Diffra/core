import type {
  StorageAdapter,
  TestRunReport,
  Viewport,
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

  private getFilename(
    targetId: string,
    viewport: Viewport,
    options?: { browser?: string },
  ): string {
    const browserSuffix = options?.browser ? `--${options.browser}` : '';
    return `${targetId.replace(/[^a-zA-Z0-9_-]/g, '_')}${browserSuffix}--${viewport.width}x${viewport.height}.png`;
  }

  async uploadCandidate(
    runId: string,
    targetId: string,
    viewport: Viewport,
    imageBuffer: Buffer,
    options?: { browser?: string },
  ): Promise<string> {
    // @ts-expect-error
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const key = `${this.prefix}/runs/${runId}/candidates/${this.getFilename(targetId, viewport, options)}`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/png',
      }),
    );
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async uploadDiff(
    runId: string,
    targetId: string,
    viewport: Viewport,
    imageBuffer: Buffer,
    options?: { browser?: string },
  ): Promise<string> {
    // @ts-expect-error
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const key = `${this.prefix}/runs/${runId}/diffs/${this.getFilename(targetId, viewport, options)}`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/png',
      }),
    );
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async downloadBaseline(
    baselineCommit: string,
    targetId: string,
    viewport: Viewport,
    options?: { browser?: string },
  ): Promise<Buffer | null> {
    // @ts-expect-error
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const key = `${this.prefix}/baselines/${baselineCommit}/${this.getFilename(targetId, viewport, options)}`;
    try {
      const response = await this.getClient().send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
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
    targetId: string,
    viewport: Viewport,
    imageBuffer: Buffer,
    options?: { browser?: string },
  ): Promise<void> {
    // @ts-expect-error
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const key = `${this.prefix}/baselines/${commitSha}/${this.getFilename(targetId, viewport, options)}`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
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
