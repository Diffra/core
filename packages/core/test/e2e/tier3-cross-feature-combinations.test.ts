import fs from 'node:fs/promises';
import path from 'node:path';
import { encodePng } from '@diffra/engine';
import { afterEach, describe, expect, it } from 'vitest';
import {
  approveBaselines,
  createImageDriver,
  LocalFilesystemAdapter,
  mergeReports,
  normalizeViewport,
  runVisualRegression,
  StorybookDriver,
} from '../../src/index.js';
import type { VisualTarget } from '../../src/types/index.js';

describe('Tier 3: Cross-Feature Combinations (Pairwise and Multi-Subsystem Interactions)', () => {
  const tempDirsToClean: string[] = [];

  function createTempDir(prefix: string): string {
    const dir = path.resolve(
      process.cwd(),
      '.diffra',
      `tier3-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
  // C1: Target List Driver + Pluggable Diff Engine + Local Storage Pipeline
  // Authoritative Source: ORIGINAL_REQUEST.md § R1, PROJECT.md Features 3 & 6
  // --------------------------------------------------------------------------
  it('C1: Pairwise combination of custom capture driver, diff engine, and local storage', async () => {
    const tempDir = createTempDir('c1-pipeline');
    const storage = new LocalFilesystemAdapter({ outputDir: tempDir });
    await storage.init();

    // Baseline image: 20x20 solid white
    const baseRgba = Buffer.alloc(20 * 20 * 4, 255);
    const basePng = encodePng(baseRgba, 20, 20);

    // Candidate image with 5x5 black box: 25 px diff
    const candRgba = Buffer.alloc(20 * 20 * 4, 255);
    for (let y = 5; y < 10; y++) {
      for (let x = 5; x < 10; x++) {
        const idx = (y * 20 + x) * 4;
        candRgba[idx] = 0;
        candRgba[idx + 1] = 0;
        candRgba[idx + 2] = 0;
      }
    }
    const candPng = encodePng(candRgba, 20, 20);

    // Pre-populate baseline for commit "git-c1-commit"
    const snapshotKey = {
      targetId: 'button--submit',
      viewport: { width: 20, height: 20 },
    };
    await storage.uploadBaseline('git-c1-commit', snapshotKey, basePng);

    const customDriver = {
      name: 'direct-c1',
      discover: async (): Promise<VisualTarget[]> => [
        {
          id: 'button--submit',
          name: 'Submit Button',
          group: 'Buttons',
        },
      ],
      capture: async () => candPng,
    };

    const report = await runVisualRegression({
      config: {
        drivers: [customDriver],
        storage,
        snapshot: {
          diffThreshold: 0.05,
          viewports: [{ width: 20, height: 20 }],
        },
      },
    });

    expect(report.results).toHaveLength(1);
    const result = report.results[0];
    expect(result.status).toBe('changed');
    expect(result.diff).toBeDefined();
    expect(result.diff?.hasDiff).toBe(true);
    expect(result.diff?.diffCount).toBe(25);
    expect(result.candidate?.path).toBeDefined();
    expect(result.diffImage?.path).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // C2: Sharded Runner Execution Combined with Report Merger Manifest
  // Authoritative Source: ORIGINAL_REQUEST.md § R4, PROJECT.md Features 20 & 25
  // --------------------------------------------------------------------------
  it('C2: Cross-feature combination of sharded execution and shard report merger', async () => {
    const tempDir1 = createTempDir('c2-shard1');
    const tempDir2 = createTempDir('c2-shard2');
    const mergedDir = createTempDir('c2-merged');

    const sampleTargets: VisualTarget[] = [
      { id: 'target-1', name: 'Header', group: 'Navigation' },
      { id: 'target-2', name: 'Sidebar', group: 'Navigation' },
      { id: 'target-3', name: 'Footer', group: 'Navigation' },
      { id: 'target-4', name: 'Content', group: 'Main' },
    ];

    const mockPng = encodePng(Buffer.alloc(10 * 10 * 4, 150), 10, 10);
    const customDriver = {
      name: 'shard-driver',
      discover: async () => sampleTargets,
      capture: async () => mockPng,
    };

    // Run Shard 1 of 2
    const report1 = await runVisualRegression({
      shard: '1/2',
      config: {
        drivers: [customDriver],
        storage: { provider: 'local', outputDir: tempDir1 },
        snapshot: { viewports: [{ width: 10, height: 10 }] },
      },
    });

    // Run Shard 2 of 2
    const report2 = await runVisualRegression({
      shard: '2/2',
      config: {
        drivers: [customDriver],
        storage: { provider: 'local', outputDir: tempDir2 },
        snapshot: { viewports: [{ width: 10, height: 10 }] },
      },
    });

    expect(report1.results.length).toBe(2);
    expect(report2.results.length).toBe(2);

    // Merge Shards
    const consolidated = await mergeReports([report1, report2], {
      outputDir: mergedDir,
    });

    expect(consolidated.results).toHaveLength(4);
    expect(consolidated.summary.total).toBe(4);
    expect(consolidated.summary.added).toBe(4);

    const mergedFile = path.join(mergedDir, 'report.json');
    const exists = await fs
      .stat(mergedFile)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  // --------------------------------------------------------------------------
  // C3: Storybook Driver Canonical Parameters + Multi-Viewport Normalization
  // Authoritative Source: AGENTS.md § 2, PROJECT.md Features 8 & 10
  // --------------------------------------------------------------------------
  it('C3: Storybook driver combines parameters.snapshot cascading with viewport normalization', () => {
    const driver = new StorybookDriver();
    const mockIndex = {
      v: 4,
      entries: {
        'modal--confirmation': {
          id: 'modal--confirmation',
          title: 'Dialogs/Modal',
          name: 'Confirmation',
          type: 'story',
          parameters: {
            snapshot: {
              delay: 350,
              diffThreshold: 0.03,
              pauseAnimationAtEnd: true,
              viewports: [
                375, // numeric width shorthand
                { width: 1024, height: 768, name: 'desktop-hd' },
              ],
            },
          },
        },
      },
    };

    const targets = driver.parseStoryIndex(
      mockIndex,
      'http://dynamic.storybook',
    );
    expect(targets).toHaveLength(1);

    const target = targets[0];
    const rawViewports = target.snapshot?.viewports || [];
    const normalized = rawViewports.map(normalizeViewport);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].width).toBe(375);
    expect(normalized[0].height).toBeGreaterThan(0); // auto-scaled standard height
    expect(normalized[1].width).toBe(1024);
    expect(normalized[1].height).toBe(768);
    expect(normalized[1].name).toBe('desktop-hd');
  });

  // --------------------------------------------------------------------------
  // C4: Image Driver Multi-Directory Scanning + Content-Addressed Storage CAS Deduplication
  // Authoritative Source: ORIGINAL_REQUEST.md § R2, PROJECT.md Features 12 & 15
  // --------------------------------------------------------------------------
  it('C4: Image driver discovery combined with CAS storage produces identical SHA-256 deduplication', async () => {
    const imagesDir = createTempDir('c4-images');
    const storageDir = createTempDir('c4-storage');

    const subDirA = path.join(imagesDir, 'brand');
    const subDirB = path.join(imagesDir, 'archived_exports');
    await fs.mkdir(subDirA, { recursive: true });
    await fs.mkdir(subDirB, { recursive: true });

    // Generate byte-for-byte identical PNG image in two distinct directories
    const sharedPng = encodePng(Buffer.alloc(16 * 16 * 4, 75), 16, 16);
    await fs.writeFile(path.join(subDirA, 'logo.png'), sharedPng);
    await fs.writeFile(path.join(subDirB, 'logo-duplicate.png'), sharedPng);

    const driver = createImageDriver({ dir: imagesDir });
    const targets = await driver.discover?.({ config: {}, cwd: process.cwd() });
    expect(targets.length).toBeGreaterThanOrEqual(2);

    const storage = new LocalFilesystemAdapter({ outputDir: storageDir });
    await storage.init();

    // Upload both candidates and verify they share the exact same content blob
    const taskA = {
      target: targets[0],
      viewport: { width: 16, height: 16 },
    };
    const taskB = {
      target: targets[1],
      viewport: { width: 16, height: 16 },
    };

    const bufA =
      (await driver.capture?.(taskA, {
        config: {},
        cwd: process.cwd(),
      })) || Buffer.alloc(0);
    const bufB =
      (await driver.capture?.(taskB, {
        config: {},
        cwd: process.cwd(),
      })) || Buffer.alloc(0);

    const pathA = await storage.uploadCandidate(
      'run-cas',
      { targetId: targets[0].id, viewport: taskA.viewport },
      bufA,
    );
    const pathB = await storage.uploadCandidate(
      'run-cas',
      { targetId: targets[1].id, viewport: taskB.viewport },
      bufB,
    );

    expect(pathA).toBeDefined();
    expect(pathB).toBeDefined();

    // Verify blob deduplication: identical buffers result in single unique blob
    const blobsDir = path.join(storageDir, 'blobs');
    const blobEntries = await fs.readdir(blobsDir);
    expect(blobEntries).toHaveLength(1);
  });

  // --------------------------------------------------------------------------
  // C5: Pipeline Run 1 (Added) -> approveBaselines -> Run 2 (CAS Fast-Path Unchanged)
  // Authoritative Source: ORIGINAL_REQUEST.md § R1, PROJECT.md Interface Contracts
  // --------------------------------------------------------------------------
  it('C5: Complete approval promotion yields 100% O(1) CAS fast-path matching on second run', async () => {
    const tempDir = createTempDir('c5-approval');
    const fixedPng = encodePng(Buffer.alloc(12 * 12 * 4, 199), 12, 12);

    const customDriver = {
      name: 'approval-driver',
      discover: async () => [
        { id: 'icon--search', name: 'Search Icon', group: 'Icons' },
      ],
      capture: async () => fixedPng,
    };

    const config = {
      drivers: [customDriver],
      storage: {
        provider: 'local' as const,
        outputDir: tempDir,
        dir: path.join(tempDir, 'baselines'),
      },
      snapshot: { viewports: [{ width: 12, height: 12 }] },
    };

    // First Run: Baseline does not exist -> Result is 'added'
    const firstReport = await runVisualRegression({ config });
    expect(firstReport.summary.added).toBe(1);
    expect(firstReport.summary.unchanged).toBe(0);

    // Promote candidate to baseline
    const approveResult = await approveBaselines({
      config,
      report: firstReport,
    });
    expect(approveResult.count).toBe(1);

    // Second Run: Candidate matches approved baseline hash -> O(1) CAS Fast-Path
    const secondReport = await runVisualRegression({ config });
    expect(secondReport.summary.added).toBe(0);
    expect(secondReport.summary.changed).toBe(0);
    expect(secondReport.summary.unchanged).toBe(1);
    expect(secondReport.summary.passed).toBe(1);
    expect(secondReport.results[0].status).toBe('unchanged');
    expect(secondReport.results[0].diff?.diffCount).toBe(0);
  });
});
