import fs from 'node:fs/promises';
import type http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPreviewHandler,
  formatServerUrl,
} from '../../action/src/preview-server.js';
import { AzureBlobStorageAdapter } from '../src/plugins/storage/azure.js';
import { GCSStorageAdapter } from '../src/plugins/storage/gcs.js';
import { LocalFilesystemAdapter } from '../src/plugins/storage/local.js';
import { S3StorageAdapter } from '../src/plugins/storage/s3.js';
import type { SnapshotKey } from '../src/types/index.js';

describe('Milestone 3 Adversarial Challenge Suite', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-m3-adv-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function createMockResponse() {
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: '',
      writeHead(status: number, headers?: Record<string, string>) {
        res.statusCode = status;
        if (headers) Object.assign(res.headers, headers);
        return res;
      },
      end(chunk?: unknown) {
        if (chunk) res.body += String(chunk);
      },
    };
    return res as unknown as http.ServerResponse & {
      statusCode: number;
      headers: Record<string, string>;
      body: string;
    };
  }

  // ==========================================================================
  // Section 1: Preview Server Path Traversal & Symlink Attacks
  // ==========================================================================
  describe('Preview Server Adversarial Attacks', () => {
    it('rejects nested, encoded, and mixed-case traversal attacks with HTTP 403', async () => {
      await fs.writeFile(
        path.join(tempDir, 'index.html'),
        '<html><body>Safe</body></html>',
      );
      const handler = createPreviewHandler(tempDir);

      const maliciousPaths = [
        '/../secret.txt',
        '/../../../../../../etc/passwd',
        '/..%2f..%2fsecret.txt',
        '/%2e%2e/%2e%2e/etc/passwd',
        '/%2e%2e%2f%2e%2e%2fsecret.txt',
        '/nested/../../../../etc/shadow',
        '/index.html/../../../etc/passwd',
        '/test/../..',
      ];

      for (const attackPath of maliciousPaths) {
        const req = { url: attackPath } as http.IncomingMessage;
        const res = createMockResponse();
        await handler(req, res);

        if (res.statusCode !== 403) {
          console.log(
            `Path ${attackPath} returned ${res.statusCode} instead of 403`,
          );
        }
        expect(res.statusCode).toBe(403);
        expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
        expect(res.body).toBe('Forbidden');
      }
    });

    it('rejects malformed URI encodings with HTTP 403', async () => {
      const handler = createPreviewHandler(tempDir);
      const malformedUrls = ['/%E0%A4%A', '/%c0%af', '/%'];

      for (const badUrl of malformedUrls) {
        const req = { url: badUrl } as http.IncomingMessage;
        const res = createMockResponse();
        await handler(req, res);

        expect(res.statusCode).toBe(403);
        expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
      }
    });

    it('detects and rejects symlink traversal escapes outside staticRoot', async () => {
      // 1. Create a secret file outside staticRoot
      const outsideDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-m3-outside-'),
      );
      const secretFile = path.join(outsideDir, 'secret.env');
      await fs.writeFile(secretFile, 'AWS_SECRET_ACCESS_KEY=super-secret-123');

      // 2. Create a symlink inside tempDir pointing to the secret file outside
      const symlinkPath = path.join(tempDir, 'symlink-to-secret.txt');
      await fs.symlink(secretFile, symlinkPath);

      const handler = createPreviewHandler(tempDir);
      const req = { url: '/symlink-to-secret.txt' } as http.IncomingMessage;
      const res = createMockResponse();

      await handler(req, res);

      // Symlink pointing outside MUST be rejected with HTTP 403 Forbidden
      expect(res.statusCode).toBe(403);
      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(res.body).toBe('Forbidden');

      await fs.rm(outsideDir, { recursive: true, force: true });
    });

    it('handles query strings and hash fragments without traversal escape', async () => {
      await fs.writeFile(path.join(tempDir, 'app.js'), 'console.log("ok");');
      const handler = createPreviewHandler(tempDir);

      // Normal request with query param and hash
      const reqSafe = {
        url: '/app.js?v=1.2.3#heading',
      } as http.IncomingMessage;
      const resSafe = createMockResponse();
      await handler(reqSafe, resSafe);
      expect(resSafe.statusCode).toBe(200);
      expect(resSafe.headers['Content-Type']).toBe(
        'application/javascript; charset=utf-8',
      );

      // Traversal disguised with query params
      const reqAttack = {
        url: '/../../etc/passwd?token=admin#hash',
      } as http.IncomingMessage;
      const resAttack = createMockResponse();
      await handler(reqAttack, resAttack);
      expect(resAttack.statusCode).toBe(403);
    });

    it('normalizes dynamic server URLs correctly supporting IPv4 and IPv6', () => {
      const mockServerIpv4 = {
        address: () => ({ address: '127.0.0.1', port: 54321, family: 'IPv4' }),
      } as unknown as http.Server;
      expect(formatServerUrl(mockServerIpv4)).toBe('http://127.0.0.1:54321');

      const mockServerWildcard = {
        address: () => ({ address: '0.0.0.0', port: 8080, family: 'IPv4' }),
      } as unknown as http.Server;
      expect(formatServerUrl(mockServerWildcard)).toBe('http://127.0.0.1:8080');

      const mockServerIpv6 = {
        address: () => ({ address: '::1', port: 9090, family: 'IPv6' }),
      } as unknown as http.Server;
      expect(formatServerUrl(mockServerIpv6)).toBe('http://[::1]:9090');
    });
  });

  // ==========================================================================
  // Section 2: Local Storage Path Traversal & Error Discrimination
  // ==========================================================================
  describe('LocalFilesystemAdapter Adversarial Boundary Tests', () => {
    it('rejects sibling directory attacks that match prefix but resolve outside baseDir', async () => {
      const baseDir = path.join(tempDir, 'base');
      await fs.mkdir(baseDir, { recursive: true });

      const adapter = new LocalFilesystemAdapter({
        outputDir: baseDir,
        baselineDir: baseDir,
      });
      await adapter.init();

      const key: SnapshotKey = {
        targetId: 'button',
        viewport: { width: 800, height: 600 },
      };
      const buf = Buffer.from('data');

      // Sibling directory: baseDir is /.../base, sibling is /.../base-evil
      // Note: uploadCandidate paths include an intermediate 'runs' segment, so 2 parent segments escape baseDir
      await expect(
        adapter.uploadCandidate('../../base-evil/run', key, buf),
      ).rejects.toThrow(/Security Error: Path traversal attempt detected/);

      // uploadBaseline has no intermediate directory, so 1 parent segment escapes baselineDir
      await expect(
        adapter.uploadBaseline('../base-evil/commit', key, buf),
      ).rejects.toThrow(/Security Error: Path traversal attempt detected/);

      await expect(
        adapter.downloadBaseline('../base-evil/commit', key),
      ).rejects.toThrow(/Security Error: Path traversal attempt detected/);
    });

    it('rethrows permission errors (EACCES/EPERM) in downloadBaseline, downloadBlob, and hasBlob', async () => {
      const adapter = new LocalFilesystemAdapter({ outputDir: tempDir });
      await adapter.init();

      const key: SnapshotKey = {
        targetId: 'button',
        viewport: { width: 800, height: 600 },
      };

      // Mock fs.readFile to throw EACCES (Permission denied)
      const eaccesError = new Error(
        'Permission denied',
      ) as NodeJS.ErrnoException;
      eaccesError.code = 'EACCES';

      const origReadFile = fs.readFile;
      const origAccess = fs.access;

      try {
        fs.readFile = vi.fn().mockRejectedValue(eaccesError);
        fs.access = vi.fn().mockRejectedValue(eaccesError);

        // downloadBaseline MUST rethrow EACCES, not swallow as null
        await expect(adapter.downloadBaseline('c1', key)).rejects.toThrow(
          /Permission denied/,
        );

        // downloadBlob MUST rethrow EACCES
        await expect(adapter.downloadBlob('hash123')).rejects.toThrow(
          /Permission denied/,
        );

        // hasBlob MUST rethrow EACCES
        await expect(adapter.hasBlob('hash123')).rejects.toThrow(
          /Permission denied/,
        );
      } finally {
        fs.readFile = origReadFile;
        fs.access = origAccess;
      }
    });

    it('sanitizes malicious characters in snapshot key targetId and browser', async () => {
      const adapter = new LocalFilesystemAdapter({ outputDir: tempDir });
      await adapter.init();

      const maliciousKey: SnapshotKey = {
        targetId: '..\\..\\evil:id*?<test>|',
        browser: 'chrom/ium;rm -rf',
        viewport: { width: 800, height: 600 },
      };
      const buf = Buffer.from('test');

      const savedPath = await adapter.uploadCandidate(
        'run-1',
        maliciousKey,
        buf,
      );
      const filename = path.basename(savedPath);

      // Traversal characters and forbidden filesystem characters must be sanitized
      expect(filename).not.toContain('..');
      expect(filename).not.toContain('/');
      expect(filename).not.toContain('\\');
      expect(filename).not.toContain('*');
      expect(filename).not.toContain('?');
      expect(filename).not.toContain('<');
      expect(filename).not.toContain('>');
      expect(filename).not.toContain('|');
    });
  });

  // ==========================================================================
  // Section 3: Cloud Storage Error Handling & Re-throw Guarantees
  // ==========================================================================
  describe('Cloud Storage Adapters Error Discrimination Guarantees', () => {
    describe('S3StorageAdapter', () => {
      it('rethrows 401 Unauthorized, 403 Forbidden, 500 ServerError, and network drops', async () => {
        const s3 = new S3StorageAdapter({ bucket: 'my-bucket' });
        const mockSend = vi.fn();
        (s3 as unknown as { s3Client: unknown }).s3Client = { send: mockSend };

        const key: SnapshotKey = {
          targetId: 'card',
          viewport: { width: 400, height: 300 },
        };

        const errorsToRethrow = [
          { name: 'InvalidAccessKeyId', $metadata: { httpStatusCode: 401 } },
          { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } },
          { name: 'InternalError', $metadata: { httpStatusCode: 500 } },
          new Error('ENOTFOUND: Unable to resolve s3.amazonaws.com'),
          new Error('ECONNRESET: Connection reset by peer'),
        ];

        for (const err of errorsToRethrow) {
          mockSend.mockRejectedValueOnce(err);
          await expect(s3.downloadBaseline('c1', key)).rejects.toThrow();

          mockSend.mockRejectedValueOnce(err);
          await expect(s3.downloadBlob('some-hash')).rejects.toThrow();

          mockSend.mockRejectedValueOnce(err);
          await expect(s3.hasBlob('some-hash')).rejects.toThrow();
        }
      });

      it('returns null / false strictly on 404 / NoSuchKey', async () => {
        const s3 = new S3StorageAdapter({ bucket: 'my-bucket' });
        const mockSend = vi.fn();
        (s3 as unknown as { s3Client: unknown }).s3Client = { send: mockSend };

        const key: SnapshotKey = {
          targetId: 'card',
          viewport: { width: 400, height: 300 },
        };

        mockSend.mockRejectedValueOnce({ name: 'NoSuchKey' });
        expect(await s3.downloadBaseline('c1', key)).toBeNull();

        mockSend.mockRejectedValueOnce({ name: 'NotFound' });
        expect(await s3.downloadBlob('hash')).toBeNull();

        mockSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
        expect(await s3.hasBlob('hash')).toBe(false);
      });
    });

    describe('GCSStorageAdapter', () => {
      it('rethrows 401, 403, and network timeouts', async () => {
        const gcs = new GCSStorageAdapter({ bucket: 'gcs-bucket' });
        const mockFile = {
          download: vi.fn(),
          exists: vi.fn(),
          save: vi.fn(),
        };
        const mockStorage = {
          bucket: vi
            .fn()
            .mockReturnValue({ file: vi.fn().mockReturnValue(mockFile) }),
        };
        (gcs as unknown as { gcsStorage: unknown }).gcsStorage = mockStorage;

        const key: SnapshotKey = {
          targetId: 'hero',
          viewport: { width: 1000, height: 500 },
        };

        const errorsToRethrow = [
          { code: 401, message: 'Invalid credentials' },
          { code: 403, message: 'Caller lacks storage permission' },
          new Error('ETIMEDOUT: Connection timed out'),
        ];

        for (const err of errorsToRethrow) {
          mockFile.download.mockRejectedValueOnce(err);
          await expect(gcs.downloadBaseline('c1', key)).rejects.toThrow();

          mockFile.download.mockRejectedValueOnce(err);
          await expect(gcs.downloadBlob('hash')).rejects.toThrow();

          mockFile.exists.mockRejectedValueOnce(err);
          await expect(gcs.hasBlob('hash')).rejects.toThrow();
        }
      });
    });

    describe('AzureBlobStorageAdapter', () => {
      it('rethrows 401, 403, and socket errors', async () => {
        const azure = new AzureBlobStorageAdapter({
          container: 'blob-container',
        });
        const mockBlockBlob = {
          downloadToBuffer: vi.fn(),
          exists: vi.fn(),
          upload: vi.fn(),
        };
        const mockContainer = {
          getBlockBlobClient: vi.fn().mockReturnValue(mockBlockBlob),
        };
        (azure as unknown as { containerClient: unknown }).containerClient =
          mockContainer;

        const key: SnapshotKey = {
          targetId: 'nav',
          viewport: { width: 200, height: 600 },
        };

        const errorsToRethrow = [
          { statusCode: 401, code: 'InvalidCredentials' },
          { statusCode: 403, code: 'AuthorizationFailure' },
          new Error('ECONNREFUSED'),
        ];

        for (const err of errorsToRethrow) {
          mockBlockBlob.downloadToBuffer.mockRejectedValueOnce(err);
          await expect(azure.downloadBaseline('c1', key)).rejects.toThrow();

          mockBlockBlob.downloadToBuffer.mockRejectedValueOnce(err);
          await expect(azure.downloadBlob('hash')).rejects.toThrow();

          mockBlockBlob.exists.mockRejectedValueOnce(err);
          await expect(azure.hasBlob('hash')).rejects.toThrow();
        }
      });
    });
  });
});
