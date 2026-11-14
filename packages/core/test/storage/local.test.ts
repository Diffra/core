import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalFilesystemAdapter } from '../../src/plugins/storage/local.js';
import type { SnapshotKey, TestRunReport } from '../../src/types/index.js';

describe('local filesystem storage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-m3-adv-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('LocalFilesystemAdapter', () => {
    let testOutputDir: string;
    let testBaselineDir: string;
    let adapter: LocalFilesystemAdapter;

    beforeEach(async () => {
      testOutputDir = path.join(tempDir, 'out');
      testBaselineDir = path.join(tempDir, 'baselines');
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
          failed: 0,
          unchanged: 0,
        },
        results: [
          {
            id: 'card--hover',
            name: 'Hover',
            group: 'Card',
            viewport: { width: 800, height: 600 },
            status: 'changed',
            candidate: {},
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

    it('rejects path traversal in every method', async () => {
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
        git: { branch: 'main', commit: 'abc1234', baselineCommit: 'abc1234' },
        summary: {
          total: 0,
          passed: 0,
          changed: 0,
          added: 0,
          removed: 0,
          failed: 0,
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
      const downloaded = await adapter.downloadBaseline(
        'non-existent-sha',
        key,
      );
      expect(downloaded).toBeNull();
    });
  });

  describe('LocalFilesystemAdapter path boundaries', () => {
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
      const adapter = new LocalFilesystemAdapter({
        outputDir: tempDir,
        baselineDir: path.join(tempDir, 'baselines'),
      });
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

  describe('LocalFilesystemAdapter CAS', () => {
    it('stores, deduplicates, and checks blobs by SHA-256 hash', async () => {
      const tmpDir = path.join(tempDir, 'cas');
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
});
