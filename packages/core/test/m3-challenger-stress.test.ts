import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatMarkdownSummary } from '../src/plugins/notifiers/summary.js';
import { AzureBlobStorageAdapter } from '../src/plugins/storage/azure.js';
import { GCSStorageAdapter } from '../src/plugins/storage/gcs.js';
import { S3StorageAdapter } from '../src/plugins/storage/s3.js';
import type { SnapshotKey, TestRunReport } from '../src/types/index.js';

describe('Milestone 3 Adversarial Challenge: Cloud Storage Error Discrimination & CAS', () => {
  const dummyKey: SnapshotKey = {
    targetId: 'button--adversarial',
    viewport: { width: 400, height: 300 },
  };
  const testBuffer = Buffer.from('adversarial-blob-data-png');
  const testHash = crypto.createHash('sha256').update(testBuffer).digest('hex');

  describe('S3 Storage Adapter Error Discrimination & CAS', () => {
    let s3: S3StorageAdapter;
    let mockSend: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      s3 = new S3StorageAdapter({
        bucket: 'adversarial-s3-bucket',
        prefix: 'adv-prefix',
        region: 'eu-west-1',
      });
      mockSend = vi.fn();
      (s3 as unknown as { s3Client: unknown }).s3Client = { send: mockSend };
    });

    it('downloadBaseline: returns null ONLY on 404 / NoSuchKey / NotFound', async () => {
      // 1. NoSuchKey by name
      mockSend.mockRejectedValueOnce({ name: 'NoSuchKey' });
      expect(await s3.downloadBaseline('sha1', dummyKey)).toBeNull();

      // 2. NoSuchKey by Code
      mockSend.mockRejectedValueOnce({ Code: 'NoSuchKey' });
      expect(await s3.downloadBaseline('sha1', dummyKey)).toBeNull();

      // 3. NotFound by name
      mockSend.mockRejectedValueOnce({ name: 'NotFound' });
      expect(await s3.downloadBaseline('sha1', dummyKey)).toBeNull();

      // 4. $metadata httpStatusCode 404
      mockSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
      expect(await s3.downloadBaseline('sha1', dummyKey)).toBeNull();
    });

    it('downloadBaseline: strictly throws on 401, 403, and network timeouts', async () => {
      // 401 Unauthorized
      mockSend.mockRejectedValueOnce({
        name: 'Unauthorized',
        $metadata: { httpStatusCode: 401 },
      });
      await expect(s3.downloadBaseline('sha1', dummyKey)).rejects.toThrow();

      // 403 AccessDenied
      mockSend.mockRejectedValueOnce({
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
        message: 'Forbidden from bucket',
      });
      await expect(s3.downloadBaseline('sha1', dummyKey)).rejects.toThrow();

      // Network Timeout
      mockSend.mockRejectedValueOnce(
        new Error('ETIMEDOUT: Connection timed out'),
      );
      await expect(s3.downloadBaseline('sha1', dummyKey)).rejects.toThrow(
        /ETIMEDOUT/,
      );

      // Connection reset
      mockSend.mockRejectedValueOnce(new Error('ECONNRESET'));
      await expect(s3.downloadBaseline('sha1', dummyKey)).rejects.toThrow(
        /ECONNRESET/,
      );
    });

    it('downloadBlob: returns null on 404, throws on 401/403/timeout', async () => {
      // 404 -> null
      mockSend.mockRejectedValueOnce({
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      });
      expect(await s3.downloadBlob(testHash)).toBeNull();

      // 403 -> throw
      mockSend.mockRejectedValueOnce({
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      });
      await expect(s3.downloadBlob(testHash)).rejects.toThrow();

      // Timeout -> throw
      mockSend.mockRejectedValueOnce(
        new Error('TimeoutError: s3 socket timed out'),
      );
      await expect(s3.downloadBlob(testHash)).rejects.toThrow(/TimeoutError/);
    });

    it('hasBlob: returns false on 404, true on success, throws on 401/403/timeout', async () => {
      // Found -> true
      mockSend.mockResolvedValueOnce({ ContentLength: testBuffer.length });
      expect(await s3.hasBlob(testHash)).toBe(true);

      // 404 NotFound -> false
      mockSend.mockRejectedValueOnce({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      });
      expect(await s3.hasBlob(testHash)).toBe(false);

      // 403 AccessDenied -> must throw!
      mockSend.mockRejectedValueOnce({
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      });
      await expect(s3.hasBlob(testHash)).rejects.toThrow();

      // Network timeout -> must throw!
      mockSend.mockRejectedValueOnce(new Error('ETIMEDOUT: HeadObject failed'));
      await expect(s3.hasBlob(testHash)).rejects.toThrow(/ETIMEDOUT/);
    });

    it('uploadBlob: uploads CAS blob and rethrows on failure', async () => {
      mockSend.mockResolvedValueOnce({});
      const url = await s3.uploadBlob(testHash, testBuffer);
      expect(url).toBe(
        `https://adversarial-s3-bucket.s3.eu-west-1.amazonaws.com/adv-prefix/blobs/${testHash}.png`,
      );

      mockSend.mockRejectedValueOnce({
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      });
      await expect(s3.uploadBlob(testHash, testBuffer)).rejects.toThrow();
    });

    it('uninitialized S3 adapter returns null on downloadBlob and false on hasBlob', async () => {
      const uninit = new S3StorageAdapter({ bucket: 'uninit-bucket' });
      expect(await uninit.downloadBaseline('sha', dummyKey)).toBeNull();
      expect(await uninit.downloadBlob('hash')).toBeNull();
      expect(await uninit.hasBlob('hash')).toBe(false);
    });
  });

  describe('S3 / Cloudflare R2 Custom Endpoint URL Formatting', () => {
    it('formats custom endpoint URL without amazonaws.com (handles trailing slashes)', async () => {
      const s3R2 = new S3StorageAdapter({
        bucket: 'my-cf-bucket',
        endpoint: 'https://custom-account.r2.cloudflarestorage.com/',
        prefix: 'snaps',
      });
      const mockSend = vi.fn().mockResolvedValue({});
      (s3R2 as unknown as { s3Client: unknown }).s3Client = { send: mockSend };

      const blobUrl = await s3R2.uploadBlob('test-hash-123', testBuffer);
      expect(blobUrl).toBe(
        'https://custom-account.r2.cloudflarestorage.com/my-cf-bucket/snaps/blobs/test-hash-123.png',
      );
      expect(blobUrl).not.toContain('amazonaws.com');
      expect(blobUrl).not.toContain('com//my-cf-bucket');

      const candUrl = await s3R2.uploadCandidate('run-1', dummyKey, testBuffer);
      expect(candUrl).toContain(
        'https://custom-account.r2.cloudflarestorage.com/my-cf-bucket/snaps/runs/run-1/candidates/',
      );
      expect(candUrl).not.toContain('amazonaws.com');
    });
  });

  describe('GCS Storage Adapter Error Discrimination & CAS', () => {
    let gcs: GCSStorageAdapter;
    let mockFile: {
      save: ReturnType<typeof vi.fn>;
      download: ReturnType<typeof vi.fn>;
      exists: ReturnType<typeof vi.fn>;
      name: string;
    };

    beforeEach(() => {
      gcs = new GCSStorageAdapter({
        bucket: 'adversarial-gcs-bucket',
        prefix: 'adv-gcs',
      });
      mockFile = {
        save: vi.fn().mockResolvedValue(undefined),
        download: vi.fn(),
        exists: vi.fn(),
        name: 'adv-gcs/blobs/test-hash.png',
      };
      const mockStorage = {
        bucket: vi.fn().mockReturnValue({
          file: vi.fn().mockReturnValue(mockFile),
        }),
      };
      (gcs as unknown as { gcsStorage: unknown }).gcsStorage = mockStorage;
    });

    it('downloadBaseline: returns null ONLY on 404, throws on 401/403/timeout', async () => {
      // 1. 404 code
      mockFile.download.mockRejectedValueOnce({
        code: 404,
        message: 'Not Found',
      });
      expect(await gcs.downloadBaseline('sha1', dummyKey)).toBeNull();

      // 2. 'No such object' message
      mockFile.download.mockRejectedValueOnce({
        message: 'No such object: adv-gcs/baselines/...',
      });
      expect(await gcs.downloadBaseline('sha1', dummyKey)).toBeNull();

      // 3. reason 'notFound'
      mockFile.download.mockRejectedValueOnce({
        errors: [{ reason: 'notFound' }],
      });
      expect(await gcs.downloadBaseline('sha1', dummyKey)).toBeNull();

      // 4. 401 Unauthorized -> must throw
      mockFile.download.mockRejectedValueOnce({
        code: 401,
        message: 'Invalid credentials',
      });
      await expect(gcs.downloadBaseline('sha1', dummyKey)).rejects.toThrow();

      // 5. 403 Forbidden -> must throw
      mockFile.download.mockRejectedValueOnce({
        code: 403,
        message: 'Forbidden',
      });
      await expect(gcs.downloadBaseline('sha1', dummyKey)).rejects.toThrow();

      // 6. Network timeout -> must throw
      mockFile.download.mockRejectedValueOnce(
        new Error('ETIMEDOUT: Google API timed out'),
      );
      await expect(gcs.downloadBaseline('sha1', dummyKey)).rejects.toThrow(
        /ETIMEDOUT/,
      );
    });

    it('downloadBlob: returns null on 404, throws on 401/403/timeout', async () => {
      // 404 -> null
      mockFile.download.mockRejectedValueOnce({ code: 404 });
      expect(await gcs.downloadBlob(testHash)).toBeNull();

      // 403 -> throw
      mockFile.download.mockRejectedValueOnce({ code: 403 });
      await expect(gcs.downloadBlob(testHash)).rejects.toThrow();

      // timeout -> throw
      mockFile.download.mockRejectedValueOnce(new Error('ESOCKETTIMEDOUT'));
      await expect(gcs.downloadBlob(testHash)).rejects.toThrow(
        /ESOCKETTIMEDOUT/,
      );
    });

    it('hasBlob: returns true/false accurately and throws on 401/403/timeout', async () => {
      // [true] -> true
      mockFile.exists.mockResolvedValueOnce([true]);
      expect(await gcs.hasBlob(testHash)).toBe(true);

      // [false] -> false
      mockFile.exists.mockResolvedValueOnce([false]);
      expect(await gcs.hasBlob(testHash)).toBe(false);

      // 404 error thrown -> false
      mockFile.exists.mockRejectedValueOnce({
        code: 404,
        message: 'Not Found',
      });
      expect(await gcs.hasBlob(testHash)).toBe(false);

      // 403 Forbidden -> must throw!
      mockFile.exists.mockRejectedValueOnce({
        code: 403,
        message: 'Caller lacks access',
      });
      await expect(gcs.hasBlob(testHash)).rejects.toThrow();

      // ETIMEDOUT -> must throw!
      mockFile.exists.mockRejectedValueOnce(new Error('ETIMEDOUT'));
      await expect(gcs.hasBlob(testHash)).rejects.toThrow(/ETIMEDOUT/);
    });

    it('uninitialized GCS adapter returns null / false', async () => {
      const uninit = new GCSStorageAdapter({ bucket: 'uninit-gcs' });
      expect(await uninit.downloadBaseline('sha', dummyKey)).toBeNull();
      expect(await uninit.downloadBlob('hash')).toBeNull();
      expect(await uninit.hasBlob('hash')).toBe(false);
    });
  });

  describe('Azure Blob Storage Adapter Error Discrimination & CAS', () => {
    let azure: AzureBlobStorageAdapter;
    let mockBlockBlobClient: {
      upload: ReturnType<typeof vi.fn>;
      downloadToBuffer: ReturnType<typeof vi.fn>;
      exists: ReturnType<typeof vi.fn>;
      url: string;
    };

    beforeEach(() => {
      azure = new AzureBlobStorageAdapter({
        container: 'adversarial-azure-container',
        prefix: 'adv-azure',
      });
      mockBlockBlobClient = {
        upload: vi.fn().mockResolvedValue({}),
        downloadToBuffer: vi.fn(),
        exists: vi.fn(),
        url: 'https://testaccount.blob.core.windows.net/adversarial-azure-container/adv-azure/blobs/hash.png',
      };
      const mockContainerClient = {
        getBlockBlobClient: vi.fn().mockReturnValue(mockBlockBlobClient),
      };
      (azure as unknown as { containerClient: unknown }).containerClient =
        mockContainerClient;
    });

    it('downloadBaseline: returns null ONLY on 404 / BlobNotFound, throws on 401/403/timeout', async () => {
      // 1. statusCode 404
      mockBlockBlobClient.downloadToBuffer.mockRejectedValueOnce({
        statusCode: 404,
      });
      expect(await azure.downloadBaseline('sha1', dummyKey)).toBeNull();

      // 2. code 'BlobNotFound'
      mockBlockBlobClient.downloadToBuffer.mockRejectedValueOnce({
        code: 'BlobNotFound',
      });
      expect(await azure.downloadBaseline('sha1', dummyKey)).toBeNull();

      // 3. details.errorCode 'BlobNotFound'
      mockBlockBlobClient.downloadToBuffer.mockRejectedValueOnce({
        details: { errorCode: 'BlobNotFound' },
      });
      expect(await azure.downloadBaseline('sha1', dummyKey)).toBeNull();

      // 4. 401 AuthenticationFailed -> must throw
      mockBlockBlobClient.downloadToBuffer.mockRejectedValueOnce({
        statusCode: 401,
        code: 'AuthenticationFailed',
      });
      await expect(azure.downloadBaseline('sha1', dummyKey)).rejects.toThrow();

      // 5. 403 AuthorizationFailure -> must throw
      mockBlockBlobClient.downloadToBuffer.mockRejectedValueOnce({
        statusCode: 403,
        code: 'AuthorizationFailure',
      });
      await expect(azure.downloadBaseline('sha1', dummyKey)).rejects.toThrow();

      // 6. Network timeout -> must throw
      mockBlockBlobClient.downloadToBuffer.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Azure storage offline'),
      );
      await expect(azure.downloadBaseline('sha1', dummyKey)).rejects.toThrow(
        /ECONNREFUSED/,
      );
    });

    it('downloadBlob: returns null on 404, throws on 401/403/timeout', async () => {
      mockBlockBlobClient.downloadToBuffer.mockRejectedValueOnce({
        statusCode: 404,
      });
      expect(await azure.downloadBlob(testHash)).toBeNull();

      mockBlockBlobClient.downloadToBuffer.mockRejectedValueOnce({
        statusCode: 403,
      });
      await expect(azure.downloadBlob(testHash)).rejects.toThrow();

      mockBlockBlobClient.downloadToBuffer.mockRejectedValueOnce(
        new Error('ETIMEDOUT'),
      );
      await expect(azure.downloadBlob(testHash)).rejects.toThrow(/ETIMEDOUT/);
    });

    it('hasBlob: returns true/false accurately and throws on 401/403/timeout', async () => {
      // true
      mockBlockBlobClient.exists.mockResolvedValueOnce(true);
      expect(await azure.hasBlob(testHash)).toBe(true);

      // false
      mockBlockBlobClient.exists.mockResolvedValueOnce(false);
      expect(await azure.hasBlob(testHash)).toBe(false);

      // 404 thrown -> false
      mockBlockBlobClient.exists.mockRejectedValueOnce({
        statusCode: 404,
        code: 'BlobNotFound',
      });
      expect(await azure.hasBlob(testHash)).toBe(false);

      // 403 thrown -> must throw!
      mockBlockBlobClient.exists.mockRejectedValueOnce({
        statusCode: 403,
        code: 'AuthorizationFailure',
      });
      await expect(azure.hasBlob(testHash)).rejects.toThrow();

      // Connection error -> must throw!
      mockBlockBlobClient.exists.mockRejectedValueOnce(new Error('ECONNRESET'));
      await expect(azure.hasBlob(testHash)).rejects.toThrow(/ECONNRESET/);
    });

    it('uninitialized Azure adapter returns null / false', async () => {
      const uninit = new AzureBlobStorageAdapter({
        container: 'uninit-container',
      });
      expect(await uninit.downloadBaseline('sha', dummyKey)).toBeNull();
      expect(await uninit.downloadBlob('hash')).toBeNull();
      expect(await uninit.hasBlob('hash')).toBe(false);
    });
  });
});

describe('Milestone 3 Adversarial Challenge: PR Summary Review Links & Security', () => {
  const sampleReport: TestRunReport = {
    runId: 'adv-run-999',
    timestamp: '2026-10-11T12:00:00Z',
    git: {
      branch: 'feature/login',
      commit: 'deadbeef123',
      baselineCommit: 'main456',
    },
    summary: {
      total: 3,
      passed: 1,
      unchanged: 1,
      changed: 1,
      added: 1,
      removed: 0,
    },
    results: [
      {
        id: 'btn-primary',
        name: 'Primary Button',
        group: 'Button',
        viewport: { width: 320, height: 480 },
        status: 'changed',
        diff: {
          diffPercentage: 1.45,
          diffCount: 120,
          totalPixels: 153600,
          diffImagePath: '/tmp/diff.png',
        },
      },
      {
        id: 'modal-terms',
        name: 'Terms Modal',
        group: 'Modal',
        viewport: { width: 800, height: 600 },
        status: 'added',
      },
    ],
  };

  it('uses viewerUrl and NEVER outputs file:// links when viewerUrl is provided', () => {
    const viewerUrl = 'https://review.diffra.io';
    const reportUrl = `${viewerUrl}/?run=adv-run-999`;

    const summary = formatMarkdownSummary(sampleReport, reportUrl, viewerUrl);

    // Must contain viewer URL
    expect(summary).toContain('https://review.diffra.io');
    expect(summary).toContain('👉 **[View Interactive Visual Report]');
    // Must NOT contain file://
    expect(summary).not.toContain('file://');
  });

  it('strictly excludes file:// URLs when no viewer is configured and reportUrl is local file', () => {
    const localReportUrl =
      'file:///Users/rawlings/core/.diffra/runs/adv-run-999/report.json';

    const summary = formatMarkdownSummary(
      sampleReport,
      localReportUrl,
      undefined,
    );

    // Must NOT contain file:// anywhere in markdown
    expect(summary).not.toContain('file://');
    // Must NOT contain a broken [View Interactive Visual Report] link
    expect(summary).not.toContain('[View Interactive Visual Report]');
    // Changed targets must NOT have file:// links
    expect(summary).toContain('**Button** / Primary Button');
    expect(summary).not.toContain('](file://');
  });

  it('uses DIFFRA_VIEWER_URL environment variable when viewerUrl option is omitted', () => {
    process.env.DIFFRA_VIEWER_URL = 'https://env-viewer.diffra.org';
    const localReportUrl =
      'file:///Users/rawlings/core/.diffra/runs/adv-run-999/report.json';

    const summary = formatMarkdownSummary(
      sampleReport,
      localReportUrl,
      undefined,
    );

    expect(summary).toContain('https://env-viewer.diffra.org/?run=adv-run-999');
    expect(summary).not.toContain('file://');

    delete process.env.DIFFRA_VIEWER_URL;
  });
});
