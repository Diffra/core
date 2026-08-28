declare module '@aws-sdk/client-s3' {
  export interface S3ClientConfig {
    region?: string;
    endpoint?: string;
  }

  export interface PutObjectCommandInput {
    Bucket: string;
    Key: string;
    Body: Buffer | Uint8Array | string;
    ContentType?: string;
  }

  export interface GetObjectCommandInput {
    Bucket: string;
    Key: string;
  }

  export interface GetObjectCommandOutput {
    Body?: AsyncIterable<Uint8Array>;
  }

  export class PutObjectCommand {
    constructor(input: PutObjectCommandInput);
  }

  export class GetObjectCommand {
    constructor(input: GetObjectCommandInput);
  }

  export class S3Client {
    constructor(config?: S3ClientConfig);
    send(command: GetObjectCommand): Promise<GetObjectCommandOutput>;
    send(command: PutObjectCommand): Promise<Record<string, unknown>>;
    send<T = unknown>(command: unknown): Promise<T>;
  }
}

declare module '@google-cloud/storage' {
  export interface FileSaveOptions {
    contentType?: string;
  }

  export interface File {
    name: string;
    save(data: Buffer | string, options?: FileSaveOptions): Promise<void>;
    download(): Promise<[Buffer]>;
  }

  export interface Bucket {
    file(name: string): File;
  }

  export class Storage {
    constructor();
    bucket(name: string): Bucket;
  }
}

declare module '@azure/storage-blob' {
  export interface BlockBlobUploadOptions {
    blobHTTPHeaders?: {
      blobContentType?: string;
    };
  }

  export interface BlockBlobClient {
    url: string;
    upload(
      data: Buffer | string,
      length: number,
      options?: BlockBlobUploadOptions,
    ): Promise<unknown>;
    downloadToBuffer(): Promise<Buffer>;
  }

  export interface ContainerClient {
    getBlockBlobClient(blobName: string): BlockBlobClient;
  }

  export class BlobServiceClient {
    static fromConnectionString(connectionString: string): BlobServiceClient;
    getContainerClient(containerName: string): ContainerClient;
  }
}
