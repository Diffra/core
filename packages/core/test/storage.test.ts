import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AzureBlobStorageAdapter } from '../src/plugins/storage/azure.js';
import { GCSStorageAdapter } from '../src/plugins/storage/gcs.js';
import { LocalFilesystemAdapter } from '../src/plugins/storage/local.js';
import { S3StorageAdapter } from '../src/plugins/storage/s3.js';
import type { TestRunReport } from '../src/types/index.js';

describe('LocalFilesystemAdapter', () => {
  const testOutputDir = '.diffra/test-tmp';
  const testBaselineDir = '.diffra/test-tmp/baselines';
  let adapter: LocalFilesystemAdapter;

  beforeEach(async () => {
    adapter = new LocalFilesystemAdapter({
      outputDir: testOutputDir,
      baselineDir: testBaselineDir,
    });
    await adapter.init();
  });

  afterEach(async () => {
    await fs.rm(path.resolve(process.cwd(), testOutputDir), {
      recursive: true,
      force: true,
    });
  });

  it('uploads candidates and retrieves baselines correctly', async () => {
    const key = {
      targetId: 'button--primary',
      viewport: { width: 800, height: 600, name: 'desktop' },
    };
    const sampleBuffer = Buffer.from('fake-png-data');

    // 1. Upload baseline for commit 'c1'
    await adapter.uploadBaseline('c1', key, sampleBuffer);

    // 2. Download baseline
    const downloaded = await adapter.downloadBaseline('c1', key);
    expect(downloaded).not.toBeNull();
    expect(downloaded?.toString()).toBe('fake-png-data');

    // 3. Upload candidate
    const candidatePath = await adapter.uploadCandidate(
      'run-123',
      key,
      sampleBuffer,
    );
    expect(candidatePath).toContain('run-123');
    expect(candidatePath).toContain('candidates');
  });

  it('saves and formats test report manifest', async () => {
    const report: TestRunReport = {
      runId: 'run-999',
      timestamp: new Date().toISOString(),
      git: {
        branch: 'feature/dark-mode',
        commit: 'abc1234',
        baselineCommit: 'main567',
      },
      summary: {
        total: 1,
        passed: 0,
        changed: 1,
        added: 0,
        removed: 0,
        unchanged: 0,
      },
      results: [
        {
          id: 'card--hover',
          name: 'Hover',
          group: 'Card',
          viewport: { width: 800, height: 600 },
          status: 'changed',
        },
      ],
    };

    const savedPath = await adapter.saveReport(report);
    expect(savedPath).toContain('run-999');

    const fileContent = await fs.readFile(savedPath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    expect(parsed.runId).toBe('run-999');
    expect(parsed.summary.changed).toBe(1);
  });

  it('strictly rejects path traversal attempts in all methods', async () => {
    const key = {
      targetId: 'button--primary',
      viewport: { width: 800, height: 600 },
    };
    const buf = Buffer.from('test-data');

    // Malicious baselineCommit
    await expect(
      adapter.downloadBaseline('../../outside-baseline', key),
    ).rejects.toThrow(/Security Error: Path traversal attempt detected/);

    // Malicious commitSha in uploadBaseline
    await expect(
      adapter.uploadBaseline('../../outside-commit', key, buf),
    ).rejects.toThrow(/Security Error: Path traversal attempt detected/);

    // Malicious runId in uploadCandidate
    await expect(
      adapter.uploadCandidate('../../outside-run', key, buf),
    ).rejects.toThrow(/Security Error: Path traversal attempt detected/);

    // Malicious runId in uploadDiff
    await expect(
      adapter.uploadDiff('../../outside-diff', key, buf),
    ).rejects.toThrow(/Security Error: Path traversal attempt detected/);

    // Malicious runId in saveReport
    const maliciousReport: TestRunReport = {
      runId: '../../outside-report',
      timestamp: new Date().toISOString(),
      summary: {
        total: 0,
        passed: 0,
        changed: 0,
        added: 0,
        removed: 0,
        unchanged: 0,
      },
      results: [],
    };
    await expect(adapter.saveReport(maliciousReport)).rejects.toThrow(
      /Security Error: Path traversal attempt detected/,
    );
  });

  it('falls back to non-browser baseline if browser-suffixed baseline is not found', async () => {
    const keyWithoutBrowser = {
      targetId: 'button--submit',
      viewport: { width: 20, height: 20 },
    };
    const keyWithBrowser = {
      targetId: 'button--submit',
      browser: 'chromium',
      viewport: { width: 20, height: 20 },
    };
    const sampleBuffer = Buffer.from('baseline-without-browser');

    // Upload baseline without browser property
    await adapter.uploadBaseline('c1', keyWithoutBrowser, sampleBuffer);

    // Download querying with browser: 'chromium'
    const downloaded = await adapter.downloadBaseline('c1', keyWithBrowser);
    expect(downloaded).not.toBeNull();
    expect(downloaded?.toString()).toBe('baseline-without-browser');
  });

  it('returns null when baseline does not exist', async () => {
    const key = {
      targetId: 'non-existent-button',
      viewport: { width: 800, height: 600 },
    };
    const downloaded = await adapter.downloadBaseline('non-existent-sha', key);
    expect(downloaded).toBeNull();
  });
});

describe('S3StorageAdapter', () => {
  it('returns null on 404 / NoSuchKey and throws on 401/403/timeout', async () => {
    const s3Adapter = new S3StorageAdapter({
      bucket: 'test-bucket',
      region: 'us-east-1',
    });

    const mockSend = vi.fn();
    (s3Adapter as unknown as { s3Client: unknown }).s3Client = {
      send: mockSend,
    };

    const key = {
      targetId: 'button--primary',
      viewport: { width: 800, height: 600 },
    };

    // 1. NoSuchKey -> returns null
    mockSend.mockRejectedValueOnce({
      name: 'NoSuchKey',
      Code: 'NoSuchKey',
      $metadata: { httpStatusCode: 404 },
    });
    const result404 = await s3Adapter.downloadBaseline('c1', key);
    expect(result404).toBeNull();

    // 2. 404 NotFound -> returns null
    mockSend.mockRejectedValueOnce({
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });
    const resultNotFound = await s3Adapter.downloadBaseline('c1', key);
    expect(resultNotFound).toBeNull();

    // 3. 403 AccessDenied -> must throw
    mockSend.mockRejectedValueOnce({
      name: 'AccessDenied',
      $metadata: { httpStatusCode: 403 },
      message: 'Access Denied to S3 bucket',
    });
    await expect(s3Adapter.downloadBaseline('c1', key)).rejects.toThrow();

    // 4. Timeout -> must throw
    mockSend.mockRejectedValueOnce(
      new Error('TimeoutError: Connection timed out after 5000ms'),
    );
    await expect(s3Adapter.downloadBaseline('c1', key)).rejects.toThrow(
      /Connection timed out/,
    );
  });

  it('uninitialized adapter returns null on downloadBaseline', async () => {
    const s3Adapter = new S3StorageAdapter({
      bucket: 'test-bucket',
      region: 'us-east-1',
    });
    const key = {
      targetId: 'button--primary',
      viewport: { width: 800, height: 600 },
    };
    const result = await s3Adapter.downloadBaseline('c1', key);
    expect(result).toBeNull();
  });

  it('formats custom endpoint URLs for Cloudflare R2 and MinIO', async () => {
    const s3Adapter = new S3StorageAdapter({
      bucket: 'my-r2-bucket',
      prefix: 'diffra-snapshots',
      endpoint: 'https://custom-account.r2.cloudflarestorage.com',
    });

    const mockSend = vi.fn().mockResolvedValue({});
    (s3Adapter as unknown as { s3Client: unknown }).s3Client = {
      send: mockSend,
    };

    const key = {
      targetId: 'header--logo',
      viewport: { width: 1200, height: 800 },
    };
    const imgBuf = Buffer.from('test-png-image');

    const candidateUrl = await s3Adapter.uploadCandidate(
      'run-custom-endpoint',
      key,
      imgBuf,
    );
    expect(candidateUrl).toBe(
      'https://custom-account.r2.cloudflarestorage.com/my-r2-bucket/diffra-snapshots/runs/run-custom-endpoint/candidates/header--logo--1200x800.png',
    );
    expect(candidateUrl).not.toContain('amazonaws.com');

    const diffUrl = await s3Adapter.uploadDiff(
      'run-custom-endpoint',
      key,
      imgBuf,
    );
    expect(diffUrl).toBe(
      'https://custom-account.r2.cloudflarestorage.com/my-r2-bucket/diffra-snapshots/runs/run-custom-endpoint/diffs/header--logo--1200x800.png',
    );
  });
});

describe('GCSStorageAdapter', () => {
  it('returns null on 404 Not Found and throws on 401/403/network error', async () => {
    const gcsAdapter = new GCSStorageAdapter({
      bucket: 'test-gcs-bucket',
    });

    const mockDownload = vi.fn();
    const mockFile = {
      download: mockDownload,
      name: 'test-file.png',
    };
    const mockStorage = {
      bucket: vi.fn().mockReturnValue({
        file: vi.fn().mockReturnValue(mockFile),
      }),
    };
    (gcsAdapter as unknown as { gcsStorage: unknown }).gcsStorage = mockStorage;

    const key = {
      targetId: 'button--submit',
      viewport: { width: 300, height: 50 },
    };

    // 1. 404 error -> returns null
    mockDownload.mockRejectedValueOnce({
      code: 404,
      message: 'No such object: diffra/baselines/c1/button--submit--300x50.png',
    });
    const result404 = await gcsAdapter.downloadBaseline('c1', key);
    expect(result404).toBeNull();

    // 2. 403 Forbidden -> must throw
    mockDownload.mockRejectedValueOnce({
      code: 403,
      message:
        'Caller does not have storage.objects.get access to the Google Cloud Storage bucket.',
    });
    await expect(gcsAdapter.downloadBaseline('c1', key)).rejects.toThrow();

    // 3. Network error -> must throw
    mockDownload.mockRejectedValueOnce(
      new Error('ETIMEDOUT: Connection reset by peer'),
    );
    await expect(gcsAdapter.downloadBaseline('c1', key)).rejects.toThrow(
      /ETIMEDOUT/,
    );
  });

  it('uninitialized adapter returns null on downloadBaseline', async () => {
    const gcsAdapter = new GCSStorageAdapter({ bucket: 'test-bucket' });
    const key = { targetId: 'btn', viewport: { width: 100, height: 100 } };
    expect(await gcsAdapter.downloadBaseline('c1', key)).toBeNull();
  });
});

describe('AzureBlobStorageAdapter', () => {
  it('returns null on 404 BlobNotFound and throws on 401/403/network error', async () => {
    const azureAdapter = new AzureBlobStorageAdapter({
      container: 'test-container',
      connectionString:
        'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=fake;',
    });

    const mockDownload = vi.fn();
    const mockBlockBlobClient = {
      downloadToBuffer: mockDownload,
      url: 'https://test.blob.core.windows.net/test-container/blob.png',
    };
    const mockContainerClient = {
      getBlockBlobClient: vi.fn().mockReturnValue(mockBlockBlobClient),
    };
    (azureAdapter as unknown as { containerClient: unknown }).containerClient =
      mockContainerClient;

    const key = {
      targetId: 'sidebar--menu',
      viewport: { width: 250, height: 800 },
    };

    // 1. 404 BlobNotFound -> returns null
    mockDownload.mockRejectedValueOnce({
      statusCode: 404,
      code: 'BlobNotFound',
      details: { errorCode: 'BlobNotFound' },
    });
    const result404 = await azureAdapter.downloadBaseline('c1', key);
    expect(result404).toBeNull();

    // 2. 403 AuthorizationFailure -> must throw
    mockDownload.mockRejectedValueOnce({
      statusCode: 403,
      code: 'AuthorizationFailure',
      details: { errorCode: 'AuthorizationFailure' },
    });
    await expect(azureAdapter.downloadBaseline('c1', key)).rejects.toThrow();

    // 3. Network connection drop -> must throw
    mockDownload.mockRejectedValueOnce(
      new Error('ECONNREFUSED: Connection refused by host'),
    );
    await expect(azureAdapter.downloadBaseline('c1', key)).rejects.toThrow(
      /ECONNREFUSED/,
    );
  });

  it('uninitialized adapter returns null on downloadBaseline', async () => {
    const azureAdapter = new AzureBlobStorageAdapter({
      container: 'test-container',
    });
    const key = { targetId: 'btn', viewport: { width: 100, height: 100 } };
    expect(await azureAdapter.downloadBaseline('c1', key)).toBeNull();
  });
});
