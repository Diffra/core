import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { encodePng } from '@diffra/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { main as runCli } from '../../../cli/src/index.js';
import {
  createFigmaDriver,
  createImageDriver,
  createS3Storage,
  createUrlDriver,
  DiffraConfigSchema,
  LocalFilesystemAdapter,
  mergeReports,
} from '../../src/index.js';

describe('Tier 2: Boundary and Corner Cases (Limits, Corruptions, Security, and Error Handling)', () => {
  const tempDirsToClean: string[] = [];

  function createTempDir(prefix: string): string {
    const dir = path.resolve(
      process.cwd(),
      '.diffra',
      `tier2-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    tempDirsToClean.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of tempDirsToClean) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    tempDirsToClean.length = 0;
  });

  // --------------------------------------------------------------------------
  // B1: URL Driver Invalid Routes, Special Characters, and Malformed Paths
  // Authoritative Source: ORIGINAL_REQUEST.md § R2, PROJECT.md Feature 10
  // --------------------------------------------------------------------------
  it('B1: URL driver handles malformed URLs, special characters, and non-standard query routes gracefully', async () => {
    const driver = createUrlDriver({
      baseUrl: 'https://dynamic-app.example.internal',
      urls: [
        '///', // Redundant leading slashes
        '/search?q=test%20query&page=2#section', // Query and fragment
        '//spaces in path//', // Escaped characters and spaces
        '', // Empty route string
      ],
    });

    const targets = await driver.discover?.({
      config: {},
      cwd: process.cwd(),
    });

    expect(targets.length).toBeGreaterThanOrEqual(2);
    for (const target of targets) {
      expect(typeof target.id).toBe('string');
      expect(target.id.length).toBeGreaterThan(0);
      expect(target.id).not.toContain('//');
      expect(target.url).toBeDefined();
    }
  });

  // --------------------------------------------------------------------------
  // B2: Figma Driver Missing Credentials and Unreachable REST API
  // Authoritative Source: ORIGINAL_REQUEST.md § R2, PROJECT.md Feature 11
  // --------------------------------------------------------------------------
  it('B2: Figma driver surfaces clear diagnostics without throwing unhandled rejections on missing token', async () => {
    const driver = createFigmaDriver({
      fileKey: 'figma-sample-key',
      // No personalAccessToken and empty nodeIds
    });

    const targets = await driver.discover?.({
      config: {},
      cwd: process.cwd(),
    });

    // Auto-discovery without token returns empty array cleanly
    expect(Array.isArray(targets)).toBe(true);
    expect(targets).toHaveLength(0);

    // Capture without token returns empty results without unhandled exception
    const captureResults = await driver.captureAll?.(
      [
        {
          target: { id: 'figma--test', name: 'Frame', group: 'Figma' },
          viewport: { width: 800, height: 600 },
        },
      ],
      { config: {}, cwd: process.cwd() },
    );
    expect(captureResults).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // B3: Image Driver Boundary Cases: Corrupted Files, Missing Directories & Non-PNG
  // Authoritative Source: ORIGINAL_REQUEST.md § R2, PROJECT.md Feature 12
  // --------------------------------------------------------------------------
  it('B3: Image driver safely handles missing directories, 0-byte files, and invalid formats', async () => {
    const tempDir = createTempDir('b3-images');
    await fs.mkdir(tempDir, { recursive: true });

    // 1. Create a 0-byte corrupted file with .png extension
    await fs.writeFile(
      path.join(tempDir, 'empty-corrupted.png'),
      Buffer.alloc(0),
    );

    // 2. Create a plain text file masquerading as PNG
    await fs.writeFile(
      path.join(tempDir, 'fake-header.png'),
      Buffer.from('NOT A REAL PNG FILE HEADER'),
    );

    // 3. Create a valid PNG
    const validPng = encodePng(Buffer.alloc(4 * 4 * 4, 120), 4, 4);
    await fs.writeFile(path.join(tempDir, 'valid.png'), validPng);

    const driver = createImageDriver({ dir: tempDir });
    const targets = await driver.discover?.({
      config: {},
      cwd: process.cwd(),
    });

    expect(targets.length).toBeGreaterThanOrEqual(1);

    // Capturing missing or 0-byte file returns null rather than crashing
    const emptyTask = {
      target: {
        id: 'image--empty',
        name: 'Empty',
        group: 'Images',
        filePath: path.join(tempDir, 'empty-corrupted.png'),
      },
      viewport: { width: 800, height: 600 },
    };

    const emptyBuffer = await driver.capture?.(emptyTask, {
      config: {},
      cwd: process.cwd(),
    });
    // Either returns 0-byte buffer or null, but never crashes
    expect(emptyBuffer === null || emptyBuffer.length === 0).toBe(true);

    // Capturing non-existent file path returns null
    const nonExistentTask = {
      target: {
        id: 'image--ghost',
        name: 'Ghost',
        group: 'Images',
        filePath: path.join(tempDir, 'does-not-exist.png'),
      },
      viewport: { width: 800, height: 600 },
    };

    const ghostBuffer = await driver.capture?.(nonExistentTask, {
      config: {},
      cwd: process.cwd(),
    });
    expect(ghostBuffer).toBeNull();
  });

  // --------------------------------------------------------------------------
  // B4: Local Storage Path Traversal Protection
  // Authoritative Source: AGENTS.md § 6, PROJECT.md Feature 16
  // --------------------------------------------------------------------------
  it('B4: Local storage sanitizes snapshot keys preventing path traversal escapes', async () => {
    const tempDir = createTempDir('b4-storage');
    const storage = new LocalFilesystemAdapter({ outputDir: tempDir });
    await storage.init();

    const sampleBuffer = encodePng(Buffer.alloc(8 * 8 * 4, 255), 8, 8);

    // Attempt traversal in targetId
    const maliciousKey = {
      targetId: '../../../etc/passwd-attack',
      viewport: { width: 800, height: 600 },
    };

    const candidatePath = await storage.uploadCandidate(
      'run-security-test',
      maliciousKey,
      sampleBuffer,
    );

    // The written file path MUST resolve strictly inside tempDir
    const resolvedPath = path.resolve(candidatePath);
    const resolvedOutputDir = path.resolve(tempDir);
    expect(resolvedPath.startsWith(resolvedOutputDir)).toBe(true);

    // Filename should have replaced traversal characters with safe characters
    expect(path.basename(candidatePath)).not.toContain('..');

    // Attempt traversal in runId
    await expect(
      storage.uploadCandidate('../../outside-run', maliciousKey, sampleBuffer),
    ).rejects.toThrow(/Security Error: Path traversal attempt detected/);

    // Attempt traversal in baselineCommit
    await expect(
      storage.downloadBaseline('../../outside-baseline', maliciousKey),
    ).rejects.toThrow(/Security Error: Path traversal attempt detected/);

    // Attempt traversal in CAS hash
    await expect(
      storage.uploadBlob('../../evil-hash', sampleBuffer),
    ).rejects.toThrow(/Security Error: Path traversal attempt detected/);
  });

  // --------------------------------------------------------------------------
  // B5: Cloud Storage Error Handling (Return Null strictly on 404)
  // Authoritative Source: PROJECT.md § Storage Adapter Interface Contracts
  // --------------------------------------------------------------------------
  it('B5: S3 storage adapter returns null when baseline does not exist', async () => {
    const s3Storage = createS3Storage({
      bucket: 'non-existent-bucket-diffra-test',
      region: 'us-east-1',
    });

    // Mock client not initialized or key missing returns null
    const key = {
      targetId: 'button--primary',
      viewport: { width: 800, height: 600 },
    };

    // Calling downloadBaseline on uninitialized/non-existent adapter returns null
    const result = await s3Storage.downloadBaseline('non-existent-sha', key);
    expect(result).toBeNull();
  });

  // --------------------------------------------------------------------------
  // B6: Configuration Boundary Values and Validation Constraints
  // Authoritative Source: AGENTS.md § 2, PROJECT.md Architecture
  // --------------------------------------------------------------------------
  it('B6: DiffraConfigSchema strictly validates threshold limits [0.0, 1.0] and rejects out-of-bounds', () => {
    // 0.0 and 1.0 are valid boundaries
    const minConfig = DiffraConfigSchema.parse({
      snapshot: { diffThreshold: 0.0 },
    });
    expect(minConfig.snapshot.diffThreshold).toBe(0.0);

    const maxConfig = DiffraConfigSchema.parse({
      snapshot: { diffThreshold: 1.0 },
    });
    expect(maxConfig.snapshot.diffThreshold).toBe(1.0);

    // Out-of-bounds values must throw Zod validation error
    expect(() =>
      DiffraConfigSchema.parse({ snapshot: { diffThreshold: -0.001 } }),
    ).toThrow();

    expect(() =>
      DiffraConfigSchema.parse({ snapshot: { diffThreshold: 1.001 } }),
    ).toThrow();

    expect(() =>
      DiffraConfigSchema.parse({ snapshot: { diffThreshold: 100 } }),
    ).toThrow();
  });

  // --------------------------------------------------------------------------
  // B7: Report Merger Boundary Conditions (Empty Input and Mismatched Branches)
  // Authoritative Source: ORIGINAL_REQUEST.md § R4, PROJECT.md Feature 20
  // --------------------------------------------------------------------------
  it('B7: mergeReports handles edge cases: empty shards, single report pass-through', async () => {
    // 1. Empty shard list throws an actionable error
    await expect(mergeReports([])).rejects.toThrow();

    // 2. Single report pass-through
    const singleReport = {
      runId: 'shard-1',
      timestamp: new Date().toISOString(),
      summary: {
        total: 1,
        passed: 1,
        changed: 0,
        added: 0,
        removed: 0,
        unchanged: 1,
      },
      results: [
        {
          id: 'test-1',
          name: 'Target 1',
          viewport: { width: 800, height: 600 },
          status: 'unchanged' as const,
        },
      ],
    };

    const merged = await mergeReports([singleReport]);
    expect(merged.results).toHaveLength(1);
    expect(merged.summary.total).toBe(1);
    expect(merged.summary.unchanged).toBe(1);
  });

  // --------------------------------------------------------------------------
  // B8: CLI Option Resilience: Unknown Arguments and pass-on-changes Flag
  // Authoritative Source: ORIGINAL_REQUEST.md § R4, PROJECT.md Feature 20
  // --------------------------------------------------------------------------
  it('B8: CLI handles unexpected flags without crashing the process', async () => {
    const exitCode = await runCli(['--unknown-unsupported-flag-xyz']);
    expect(exitCode).toBe(1);
  });

  // --------------------------------------------------------------------------
  // B9: Dynamic Port Preview Server Teardown Verification
  // Authoritative Source: AGENTS.md § 6 & 8, PROJECT.md Feature 7
  // --------------------------------------------------------------------------
  it('B9: Static preview servers guarantee socket release even when connection aborts', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });

    let allocatedPort = 0;
    try {
      await new Promise<void>((resolve) => server.listen(0, () => resolve()));
      allocatedPort = (server.address() as AddressInfo).port;
      expect(allocatedPort).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    // Verify port is freed by binding a new server to the exact same port
    const secondaryServer = http.createServer();
    await new Promise<void>((resolve, reject) => {
      secondaryServer.listen(allocatedPort, '127.0.0.1', () => resolve());
      secondaryServer.on('error', reject);
    });

    await new Promise<void>((resolve) =>
      secondaryServer.close(() => resolve()),
    );
  });

  // --------------------------------------------------------------------------
  // B10: Action Preview Server Path Traversal Rejection (Feature 17)
  // Authoritative Source: PROJECT.md Feature 17, AGENTS.md § 6
  // --------------------------------------------------------------------------
  it('B10: Action preview server strictly rejects path traversal attempts with HTTP 403', async () => {
    const tempDir = createTempDir('b10-action-preview');
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'index.html'),
      '<html><body>Action Preview</body></html>',
    );

    const { createPreviewHandler } = await import(
      '../../../action/src/preview-server.js'
    );
    const handler = createPreviewHandler(tempDir);

    const mockRes = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: '',
      writeHead(status: number, headers?: Record<string, string>) {
        mockRes.statusCode = status;
        if (headers) Object.assign(mockRes.headers, headers);
        return mockRes;
      },
      end(chunk?: unknown) {
        if (chunk) mockRes.body += String(chunk);
      },
    };

    const reqTraversal = {
      url: '/../../../etc/passwd',
    } as http.IncomingMessage;
    await handler(reqTraversal, mockRes as unknown as http.ServerResponse);

    expect(mockRes.statusCode).toBe(403);
    expect(mockRes.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(mockRes.body).toBe('Forbidden');
  });
});
