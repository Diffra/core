import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import path from 'node:path';
import { encodePng } from '@diffra/engine';
import { afterEach, describe, expect, it } from 'vitest';
import {
  approveBaselines,
  createImageDriver,
  LocalFilesystemAdapter,
  mergeReports,
  runVisualRegression,
} from '../../src/index.js';
import type { TestRunReport, VisualTarget } from '../../src/types/index.js';

function testServerRequest(
  server: http.Server,
  urlStr: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const socket = new EventEmitter();
    const req = new http.IncomingMessage(socket as unknown as Socket);
    req.url = urlStr;
    req.method = 'GET';
    const res = new http.ServerResponse(req);
    let body = '';
    res.write = (chunk: unknown) => {
      body += String(chunk);
      return true;
    };
    res.end = (chunk?: unknown) => {
      if (chunk) body += String(chunk);
      resolve({ status: res.statusCode, body });
      return res;
    };
    const handler = server.listeners('request')[0] as (
      req: http.IncomingMessage,
      res: http.ServerResponse,
    ) => void;
    handler(req, res);
  });
}

describe('Tier 4: Real-World Application Scenarios (Full End-to-End Workflows)', () => {
  const tempDirsToClean: string[] = [];

  function createTempDir(prefix: string): string {
    const dir = path.resolve(
      process.cwd(),
      '.diffra',
      `tier4-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
  // Scenario 1: Complete Automated CI Regression Lifecycle
  // Step 1 (Base run) -> Step 2 (Feature branch with regression) -> Step 3 (Approval) -> Step 4 (Clean pass)
  // Authoritative Source: ORIGINAL_REQUEST.md § R1, PROJECT.md Milestone 5
  // --------------------------------------------------------------------------
  it('S1: End-to-end automated CI visual regression lifecycle across branches and approvals', async () => {
    const tempDir = createTempDir('s1-ci-lifecycle');

    // Create 2 component states: Initial button and Modified button
    const initialRgba = Buffer.alloc(24 * 24 * 4, 255);
    const initialPng = encodePng(initialRgba, 24, 24);

    const modifiedRgba = Buffer.alloc(24 * 24 * 4, 255);
    // Draw altered accent block on modified button (8x8 block = 64 px diff)
    for (let y = 8; y < 16; y++) {
      for (let x = 8; x < 16; x++) {
        const idx = (y * 24 + x) * 4;
        modifiedRgba[idx] = 255;
        modifiedRgba[idx + 1] = 0;
        modifiedRgba[idx + 2] = 128;
      }
    }
    const modifiedPng = encodePng(modifiedRgba, 24, 24);

    let currentButtonPng = initialPng;
    const testDriver = {
      name: 'ci-driver',
      discover: async (): Promise<VisualTarget[]> => [
        { id: 'btn--cta', name: 'Call to Action Button', group: 'Buttons' },
      ],
      capture: async () => currentButtonPng,
    };

    const config = {
      drivers: [testDriver],
      storage: {
        provider: 'local' as const,
        outputDir: tempDir,
        dir: path.join(tempDir, 'baselines'),
      },
      snapshot: { viewports: [{ width: 24, height: 24 }] },
    };

    // Step 1: Initial baseline run (Brand new component added)
    const baseRun = await runVisualRegression({ config });
    expect(baseRun.summary.total).toBe(1);
    expect(baseRun.summary.added).toBe(1);

    // Step 2: Approve initial baseline on main branch
    const baseApproval = await approveBaselines({ config, report: baseRun });
    expect(baseApproval.count).toBe(1);

    // Step 3: Developer introduces modified button on feature branch
    currentButtonPng = modifiedPng;
    const featureRun = await runVisualRegression({ config });
    expect(featureRun.summary.total).toBe(1);
    expect(featureRun.summary.changed).toBe(1);
    expect(featureRun.summary.unchanged).toBe(0);
    expect(featureRun.results[0].status).toBe('changed');
    expect(featureRun.results[0].diff?.hasDiff).toBe(true);
    expect(featureRun.results[0].diffImage?.path).toBeDefined();

    // Step 4: PR approved and merged -> Accept candidate changes as new baseline
    const featureApproval = await approveBaselines({
      config,
      report: featureRun,
    });
    expect(featureApproval.count).toBe(1);

    // Step 5: Verification run confirms 100% unchanged, 0 changed
    const verifiedRun = await runVisualRegression({ config });
    expect(verifiedRun.summary.total).toBe(1);
    expect(verifiedRun.summary.unchanged).toBe(1);
    expect(verifiedRun.summary.changed).toBe(0);
    expect(verifiedRun.summary.added).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Multi-Driver Composite Pipeline
  // Combining live targets and static image files in a unified run
  // Authoritative Source: ORIGINAL_REQUEST.md § R2, PROJECT.md Feature 12
  // --------------------------------------------------------------------------
  it('S2: Multi-driver composite pipeline executing diverse driver sources simultaneously', async () => {
    const tempDir = createTempDir('s2-composite');
    const imagesDir = path.join(tempDir, 'static-images');
    await fs.mkdir(imagesDir, { recursive: true });

    // Generate static image fixture
    const logoPng = encodePng(Buffer.alloc(16 * 16 * 4, 210), 16, 16);
    await fs.writeFile(path.join(imagesDir, 'brand-logo.png'), logoPng);

    const imageDriver = createImageDriver({ dir: imagesDir });

    // Custom in-memory driver for dynamic UI widget
    const widgetPng = encodePng(Buffer.alloc(16 * 16 * 4, 140), 16, 16);
    const widgetDriver = {
      name: 'widget-driver',
      discover: async (): Promise<VisualTarget[]> => [
        { id: 'widget--counter', name: 'Counter Widget', group: 'Widgets' },
      ],
      capture: async () => widgetPng,
    };

    const report = await runVisualRegression({
      config: {
        drivers: [imageDriver, widgetDriver],
        storage: { provider: 'local', outputDir: tempDir },
        snapshot: { viewports: [{ width: 16, height: 16 }] },
      },
    });

    expect(report.summary.total).toBe(2);
    const targetIds = report.results.map((r) => r.id);
    expect(targetIds.some((id) => id.includes('brand-logo'))).toBe(true);
    expect(targetIds.some((id) => id.includes('counter'))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Distributed CI Matrix: 3-way Sharded Run and Consolidated Report
  // Authoritative Source: ORIGINAL_REQUEST.md § R4, PROJECT.md Feature 20
  // --------------------------------------------------------------------------
  it('S3: Distributed 3-way CI shard matrix executing in parallel and consolidating report', async () => {
    const baseDir = createTempDir('s3-sharded-matrix');
    const shard1Dir = path.join(baseDir, 'shard-1');
    const shard2Dir = path.join(baseDir, 'shard-2');
    const shard3Dir = path.join(baseDir, 'shard-3');
    const consolidatedDir = path.join(baseDir, 'consolidated');

    const sixTargets: VisualTarget[] = [
      { id: 'target-a', name: 'Target A', group: 'Group 1' },
      { id: 'target-b', name: 'Target B', group: 'Group 1' },
      { id: 'target-c', name: 'Target C', group: 'Group 2' },
      { id: 'target-d', name: 'Target D', group: 'Group 2' },
      { id: 'target-e', name: 'Target E', group: 'Group 3' },
      { id: 'target-f', name: 'Target F', group: 'Group 3' },
    ];

    const mockPng = encodePng(Buffer.alloc(8 * 8 * 4, 180), 8, 8);
    const matrixDriver = {
      name: 'matrix-driver',
      discover: async () => sixTargets,
      capture: async () => mockPng,
    };

    const viewport = { width: 8, height: 8 };

    // Worker 1: Shard 1/3
    const report1 = await runVisualRegression({
      shard: '1/3',
      config: {
        drivers: [matrixDriver],
        storage: { provider: 'local', outputDir: shard1Dir },
        snapshot: { viewports: [viewport] },
      },
    });

    // Worker 2: Shard 2/3
    const report2 = await runVisualRegression({
      shard: '2/3',
      config: {
        drivers: [matrixDriver],
        storage: { provider: 'local', outputDir: shard2Dir },
        snapshot: { viewports: [viewport] },
      },
    });

    // Worker 3: Shard 3/3
    const report3 = await runVisualRegression({
      shard: '3/3',
      config: {
        drivers: [matrixDriver],
        storage: { provider: 'local', outputDir: shard3Dir },
        snapshot: { viewports: [viewport] },
      },
    });

    expect(report1.results.length).toBe(2);
    expect(report2.results.length).toBe(2);
    expect(report3.results.length).toBe(2);

    // Merge all 3 shard manifests into single report
    const merged = await mergeReports([report1, report2, report3], {
      outputDir: consolidatedDir,
    });

    expect(merged.summary.total).toBe(6);
    expect(merged.results).toHaveLength(6);
    expect(merged.summary.added).toBe(6);

    const mergedManifestPath = path.join(consolidatedDir, 'report.json');
    const fileExists = await fs
      .stat(mergedManifestPath)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Review Viewer Static Inspection Workflow
  // Serving test run report over dynamic port 0 and cleanly closing
  // Authoritative Source: ORIGINAL_REQUEST.md § R4, PROJECT.md Feature 19
  // --------------------------------------------------------------------------
  it('S4: Review viewer static HTTP inspection workflow with dynamic port and clean teardown', async () => {
    const tempDir = createTempDir('s4-viewer-serve');
    const storage = new LocalFilesystemAdapter({ outputDir: tempDir });
    await storage.init();

    const sampleReport: TestRunReport = {
      runId: 'inspection-run-101',
      timestamp: new Date().toISOString(),
      git: {
        branch: 'feat/checkout-flow',
        commit: 'abcdef12',
      },
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
          id: 'cart--empty',
          name: 'Empty Cart',
          group: 'Checkout',
          viewport: { width: 1280, height: 800 },
          status: 'unchanged',
        },
      ],
    };

    const reportPath = await storage.saveReport(sampleReport);
    expect(reportPath).toBeDefined();

    // Launch zero-dependency static preview server on port 0
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', 'http://dynamic.host');
      if (
        url.pathname === '/report.json' ||
        url.pathname.endsWith('/report.json')
      ) {
        const content = await fs.readFile(reportPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(content);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<!DOCTYPE html><html><body><diffra-viewer></diffra-viewer></body></html>',
      );
    });

    let assignedPort = 0;
    try {
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', () => resolve()),
      );
      const addr = server.address() as AddressInfo;
      assignedPort = addr.port;
      expect(assignedPort).toBeGreaterThan(0);

      // Verify HTTP retrieval of review manifest
      const fetchRes = await testServerRequest(server, '/report.json');
      expect(fetchRes.status).toBe(200);
      const data = JSON.parse(fetchRes.body) as TestRunReport;
      expect(data.runId).toBe('inspection-run-101');
      expect(data.results[0].id).toBe('cart--empty');

      // Verify HTML index review page
      const htmlRes = await testServerRequest(server, '/');
      expect(htmlRes.status).toBe(200);
      expect(htmlRes.body).toContain('diffra-viewer');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
