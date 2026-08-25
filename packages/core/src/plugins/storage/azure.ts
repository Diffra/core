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

interface BlockBlobClientLike {
  upload: (
    data: Buffer | string,
    length: number,
    options?: { blobHTTPHeaders?: { blobContentType?: string } },
  ) => Promise<unknown>;
  downloadToBuffer: () => Promise<Buffer>;
  url: string;
}

interface ContainerClientLike {
  getBlockBlobClient: (name: string) => BlockBlobClientLike;
}

export class AzureBlobStorageAdapter implements StorageAdapter {
  name = 'azure';
  private containerName: string;
  private connectionString?: string;
  private prefix: string;
  private containerClient: ContainerClientLike | null = null;

  constructor(options: AzureStorageOptions) {
    this.containerName = options.container;
    this.connectionString =
      options.connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.prefix = options.prefix || 'diffra';
  }

  async init(): Promise<void> {
    // @ts-expect-error
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

  private getClient(): ContainerClientLike {
    if (!this.containerClient) {
      throw new Error('Azure Blob Storage not initialized');
    }
    return this.containerClient;
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
    const blobName = `${this.prefix}/baselines/${baselineCommit}/${this.getFilename(key)}`;
    const blockBlobClient = this.getClient().getBlockBlobClient(blobName);
    try {
      return await blockBlobClient.downloadToBuffer();
    } catch {
      return null;
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
