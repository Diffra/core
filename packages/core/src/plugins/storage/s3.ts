import type { S3Client } from '@aws-sdk/client-s3';
import type {
  SnapshotKey,
  StorageAdapter,
  TestRunReport,
} from '../../types/index.js';
import { assertDocumentName, DOCUMENTS_DIR } from './documents.js';
import { BASELINE_KEYS_FILE, parseKeys, serializeKeys } from './keys.js';
import { loadSdk } from './optional-sdk.js';

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
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private s3Client: S3Client | null = null;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.prefix = options.prefix || 'diffra';
    this.region = options.region || 'us-east-1';
    this.endpoint = options.endpoint;
  }

  async init(): Promise<void> {
    const { S3Client } = await this.getSdk();
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

  private getSdk() {
    return loadSdk(
      () => import('@aws-sdk/client-s3'),
      '@aws-sdk/client-s3',
      's3',
    );
  }

  private getCommands() {
    return this.getSdk();
  }

  /** Reads an object, or returns null when it does not exist. */
  private async getObjectBuffer(objectKey: string): Promise<Buffer | null> {
    const { GetObjectCommand } = await this.getSdk();
    try {
      const response = await this.getClient().send(
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      return response.Body
        ? Buffer.from(await response.Body.transformToByteArray())
        : Buffer.alloc(0);
    } catch (err: unknown) {
      if (isS3NotFound(err)) {
        return null;
      }
      throw err;
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
    return this.getObjectBuffer(`${this.prefix}/blobs/${hash}.png`);
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

  private documentKey(name: string): string {
    return `${this.prefix}/${DOCUMENTS_DIR}/${assertDocumentName(name)}`;
  }

  async uploadDocument(name: string, content: Buffer): Promise<void> {
    const { PutObjectCommand } = await this.getCommands();
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.documentKey(name),
        Body: content,
        ContentType: 'application/json',
      }),
    );
  }

  async downloadDocument(name: string): Promise<Buffer | null> {
    if (!this.s3Client) return null;
    return this.getObjectBuffer(this.documentKey(name));
  }

  async hasDocument(name: string): Promise<boolean> {
    if (!this.s3Client) return false;
    const { HeadObjectCommand } = await this.getCommands();
    try {
      await this.getClient().send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.documentKey(name),
        }),
      );
      return true;
    } catch (err: unknown) {
      if (isS3NotFound(err)) return false;
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
    return this.getObjectBuffer(
      `${this.prefix}/baselines/${baselineCommit}/${this.getFilename(key)}`,
    );
  }

  async downloadCandidate(
    runId: string,
    key: SnapshotKey,
  ): Promise<Buffer | null> {
    if (!this.s3Client) {
      return null;
    }
    return this.getObjectBuffer(
      `${this.prefix}/runs/${runId}/candidates/${this.getFilename(key)}`,
    );
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

  async downloadBaselineKeys(commit: string): Promise<SnapshotKey[] | null> {
    if (!this.s3Client) return null;
    const stored = await this.getObjectBuffer(
      `${this.prefix}/baselines/${commit}/${BASELINE_KEYS_FILE}`,
    );
    return stored ? parseKeys(stored) : null;
  }

  async uploadBaselineKeys(commit: string, keys: SnapshotKey[]): Promise<void> {
    const { PutObjectCommand } = await this.getCommands();
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `${this.prefix}/baselines/${commit}/${BASELINE_KEYS_FILE}`,
        Body: serializeKeys(keys),
        ContentType: 'application/json',
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
