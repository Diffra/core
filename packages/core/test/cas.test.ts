import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AzureBlobStorageAdapter } from '../src/plugins/storage/azure.js';
import { GCSStorageAdapter } from '../src/plugins/storage/gcs.js';
import { LocalFilesystemAdapter } from '../src/plugins/storage/local.js';
import { S3StorageAdapter } from '../src/plugins/storage/s3.js';

describe('Content-Addressed Storage (CAS)', () => {
  describe('LocalFilesystemAdapter CAS', () => {
    it('stores, deduplicates, and checks blobs by SHA-256 hash', async () => {
      const tmpDir = path.join(process.cwd(), '.diffra-test-cas-local');
      await fs.rm(tmpDir, { recursive: true, force: true });
      const storage = new LocalFilesystemAdapter({ outputDir: tmpDir });
      await storage.init();

      const imgBuffer = Buffer.from('fake-png-data-for-cas-test');
      const hash = crypto.createHash('sha256').update(imgBuffer).digest('hex');

      // 1. Initially blob does not exist
      expect(await storage.hasBlob(hash)).toBe(false);
      expect(await storage.downloadBlob(hash)).toBeNull();

      // 2. Upload blob
      const blobPath = await storage.uploadBlob(hash, imgBuffer);
      expect(blobPath).toContain(hash);

      // 3. Existence and download check
      expect(await storage.hasBlob(hash)).toBe(true);
      const downloaded = await storage.downloadBlob(hash);
      expect(downloaded).toEqual(imgBuffer);

      // 4. Idempotent upload
      const secondUpload = await storage.uploadBlob(hash, imgBuffer);
      expect(secondUpload).toBe(blobPath);

      // 5. Path traversal rejection in hash
      await expect(
        storage.uploadBlob('../../evil-hash', imgBuffer),
      ).rejects.toThrow(/Security Error: Path traversal attempt detected/);
      await expect(storage.downloadBlob('../../evil-hash')).rejects.toThrow(
        /Security Error: Path traversal attempt detected/,
      );
      await expect(storage.hasBlob('../../evil-hash')).rejects.toThrow(
        /Security Error: Path traversal attempt detected/,
      );

      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
    });
  });

  describe('S3StorageAdapter CAS', () => {
    it('implements uploadBlob, downloadBlob, and hasBlob with error discrimination', async () => {
      const s3 = new S3StorageAdapter({
        bucket: 'test-bucket',
        region: 'us-east-1',
      });

      // 1. Uninitialized adapter safely returns null / false
      expect(await s3.hasBlob('abc')).toBe(false);
      expect(await s3.downloadBlob('abc')).toBeNull();

      // 2. Mock initialized client
      const mockSend = vi.fn();
      (s3 as unknown as { s3Client: unknown }).s3Client = { send: mockSend };

      const imgBuf = Buffer.from('s3-blob-data');
      const hash = crypto.createHash('sha256').update(imgBuf).digest('hex');

      // Upload
      mockSend.mockResolvedValueOnce({});
      const url = await s3.uploadBlob(hash, imgBuf);
      expect(url).toBe(
        `https://test-bucket.s3.us-east-1.amazonaws.com/diffra/blobs/${hash}.png`,
      );

      // hasBlob found
      mockSend.mockResolvedValueOnce({ ContentLength: imgBuf.length });
      expect(await s3.hasBlob(hash)).toBe(true);

      // hasBlob 404
      mockSend.mockRejectedValueOnce({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      });
      expect(await s3.hasBlob('missing-hash')).toBe(false);

      // downloadBlob found
      mockSend.mockResolvedValueOnce({
        Body: (async function* () {
          yield new Uint8Array(imgBuf);
        })(),
      });
      const downloaded = await s3.downloadBlob(hash);
      expect(downloaded).toEqual(imgBuf);

      // downloadBlob 404
      mockSend.mockRejectedValueOnce({
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      });
      expect(await s3.downloadBlob('missing-hash')).toBeNull();

      // downloadBlob 403 throws
      mockSend.mockRejectedValueOnce({
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      });
      await expect(s3.downloadBlob(hash)).rejects.toThrow();
    });
  });

  describe('GCSStorageAdapter CAS', () => {
    it('implements uploadBlob, downloadBlob, and hasBlob with error discrimination', async () => {
      const gcs = new GCSStorageAdapter({ bucket: 'test-gcs' });

      // Uninitialized
      expect(await gcs.hasBlob('abc')).toBe(false);
      expect(await gcs.downloadBlob('abc')).toBeNull();

      const mockFile = {
        save: vi.fn().mockResolvedValue(undefined),
        download: vi.fn(),
        exists: vi.fn(),
        name: 'diffra/blobs/test-hash.png',
      };
      const mockStorage = {
        bucket: vi.fn().mockReturnValue({
          file: vi.fn().mockReturnValue(mockFile),
        }),
      };
      (gcs as unknown as { gcsStorage: unknown }).gcsStorage = mockStorage;

      const imgBuf = Buffer.from('gcs-blob-content');
      const hash = 'test-hash';

      // Upload
      const url = await gcs.uploadBlob(hash, imgBuf);
      expect(url).toBe(
        'https://storage.googleapis.com/test-gcs/diffra/blobs/test-hash.png',
      );

      // hasBlob true
      mockFile.exists.mockResolvedValueOnce([true]);
      expect(await gcs.hasBlob(hash)).toBe(true);

      // hasBlob false
      mockFile.exists.mockResolvedValueOnce([false]);
      expect(await gcs.hasBlob('missing')).toBe(false);

      // downloadBlob found
      mockFile.download.mockResolvedValueOnce([imgBuf]);
      expect(await gcs.downloadBlob(hash)).toEqual(imgBuf);

      // downloadBlob 404
      mockFile.download.mockRejectedValueOnce({
        code: 404,
        message: 'Not Found',
      });
      expect(await gcs.downloadBlob('missing')).toBeNull();

      // downloadBlob 403 throws
      mockFile.download.mockRejectedValueOnce({
        code: 403,
        message: 'Forbidden',
      });
      await expect(gcs.downloadBlob(hash)).rejects.toThrow();
    });
  });

  describe('AzureBlobStorageAdapter CAS', () => {
    it('implements uploadBlob, downloadBlob, and hasBlob with error discrimination', async () => {
      const azure = new AzureBlobStorageAdapter({ container: 'test-azure' });

      // Uninitialized
      expect(await azure.hasBlob('abc')).toBe(false);
      expect(await azure.downloadBlob('abc')).toBeNull();

      const mockBlockBlobClient = {
        upload: vi.fn().mockResolvedValue({}),
        downloadToBuffer: vi.fn(),
        exists: vi.fn(),
        url: 'https://account.blob.core.windows.net/test-azure/diffra/blobs/azure-hash.png',
      };
      const mockContainerClient = {
        getBlockBlobClient: vi.fn().mockReturnValue(mockBlockBlobClient),
      };
      (azure as unknown as { containerClient: unknown }).containerClient =
        mockContainerClient;

      const imgBuf = Buffer.from('azure-blob-data');
      const hash = 'azure-hash';

      // Upload
      const url = await azure.uploadBlob(hash, imgBuf);
      expect(url).toContain('azure-hash.png');

      // hasBlob true
      mockBlockBlobClient.exists.mockResolvedValueOnce(true);
      expect(await azure.hasBlob(hash)).toBe(true);

      // hasBlob false
      mockBlockBlobClient.exists.mockResolvedValueOnce(false);
      expect(await azure.hasBlob('missing')).toBe(false);

      // downloadBlob found
      mockBlockBlobClient.downloadToBuffer.mockResolvedValueOnce(imgBuf);
      expect(await azure.downloadBlob(hash)).toEqual(imgBuf);

      // downloadBlob 404
      mockBlockBlobClient.downloadToBuffer.mockRejectedValueOnce({
        statusCode: 404,
        code: 'BlobNotFound',
      });
      expect(await azure.downloadBlob('missing')).toBeNull();

      // downloadBlob 403 throws
      mockBlockBlobClient.downloadToBuffer.mockRejectedValueOnce({
        statusCode: 403,
        code: 'AuthorizationFailure',
      });
      await expect(azure.downloadBlob(hash)).rejects.toThrow();
    });
  });
});
