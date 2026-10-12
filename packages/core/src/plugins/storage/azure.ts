import type { ContainerClient } from '@azure/storage-blob';
import type {
  SnapshotKey,
  StorageAdapter,
  TestRunReport,
} from '../../types/index.js';

export interface AzureStorageOptions {
  container: string;
  connectionString?: string;
  prefix?: string;
}

function isAzureNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    statusCode?: number;
    code?: string;
    details?: { errorCode?: string };
  };
  return (
    e.statusCode === 404 ||
    e.code === 'BlobNotFound' ||
    e.details?.errorCode === 'BlobNotFound'
  );
}

export class AzureBlobStorageAdapter implements StorageAdapter {
  name = 'azure';
  private containerName: string;
  private connectionString?: string;
  private prefix: string;
  private containerClient: ContainerClient | null = null;

  constructor(options: AzureStorageOptions) {
    this.containerName = options.container;
    this.connectionString =
      options.connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.prefix = options.prefix || 'diffra';
  }

  async init(): Promise<void> {
    const { BlobServiceClient } = await import('@azure/storage-blob');
    if (!this.connectionString) {
      throw new Error('Azure connectionString is required');
    }
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      this.connectionString,
    );
    this.containerClient = blobServiceClient.getContainerClient(
      this.containerName,
    );
  }

  private getClient(): ContainerClient {
    if (!this.containerClient) {
      throw new Error('Azure Blob Storage not initialized');
    }
    return this.containerClient;
  }

  private getFilename(key: SnapshotKey): string {
    const browserSuffix = key.browser
      ? `--${key.browser.replace(/[^a-zA-Z0-9_-]/g, '_')}`
      : '';
    return `${key.targetId.replace(/[^a-zA-Z0-9_-]/g, '_')}${browserSuffix}--${key.viewport.width}x${key.viewport.height}.png`;
  }

  async uploadBlob(hash: string, imageBuffer: Buffer): Promise<string> {
    const blobName = `${this.prefix}/blobs/${hash}.png`;
    const blockBlobClient = this.getClient().getBlockBlobClient(blobName);
    await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
      blobHTTPHeaders: { blobContentType: 'image/png' },
    });
    return blockBlobClient.url;
  }

  async downloadBlob(hash: string): Promise<Buffer | null> {
    if (!this.containerClient) return null;
    const blobName = `${this.prefix}/blobs/${hash}.png`;
    const blockBlobClient = this.getClient().getBlockBlobClient(blobName);
    try {
      return await blockBlobClient.downloadToBuffer();
    } catch (err: unknown) {
      if (isAzureNotFound(err)) {
        return null;
      }
      throw err;
    }
  }

  async hasBlob(hash: string): Promise<boolean> {
    if (!this.containerClient) return false;
    const blobName = `${this.prefix}/blobs/${hash}.png`;
    const blockBlobClient = this.getClient().getBlockBlobClient(blobName);
    try {
      return await blockBlobClient.exists();
    } catch (err: unknown) {
      if (isAzureNotFound(err)) {
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
    const blobName = `${this.prefix}/runs/${runId}/candidates/${this.getFilename(key)}`;
    const blockBlobClient = this.getClient().getBlockBlobClient(blobName);
    await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
      blobHTTPHeaders: { blobContentType: 'image/png' },
    });
    return blockBlobClient.url;
  }

  async uploadDiff(
    runId: string,
    key: SnapshotKey,
    imageBuffer: Buffer,
  ): Promise<string> {
    const blobName = `${this.prefix}/runs/${runId}/diffs/${this.getFilename(key)}`;
    const blockBlobClient = this.getClient().getBlockBlobClient(blobName);
    await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
      blobHTTPHeaders: { blobContentType: 'image/png' },
    });
    return blockBlobClient.url;
  }

  async downloadBaseline(
    baselineCommit: string,
    key: SnapshotKey,
  ): Promise<Buffer | null> {
    if (!this.containerClient) {
      return null;
    }
    const blobName = `${this.prefix}/baselines/${baselineCommit}/${this.getFilename(key)}`;
    const blockBlobClient = this.getClient().getBlockBlobClient(blobName);
    try {
      return await blockBlobClient.downloadToBuffer();
    } catch (err: unknown) {
      if (isAzureNotFound(err)) {
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
    const blobName = `${this.prefix}/baselines/${commitSha}/${this.getFilename(key)}`;
    const blockBlobClient = this.getClient().getBlockBlobClient(blobName);
    await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
      blobHTTPHeaders: { blobContentType: 'image/png' },
    });
  }

  async saveReport(report: TestRunReport): Promise<string> {
    const blobName = `${this.prefix}/runs/${report.runId}/report.json`;
    const blockBlobClient = this.getClient().getBlockBlobClient(blobName);
    const content = JSON.stringify(report, null, 2);
    await blockBlobClient.upload(content, content.length, {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
    return blockBlobClient.url;
  }
}

export function createAzureStorage(
  options: AzureStorageOptions,
): StorageAdapter {
  return new AzureBlobStorageAdapter(options);
}
