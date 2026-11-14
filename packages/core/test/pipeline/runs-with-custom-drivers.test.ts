import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { encodePng } from '@diffra/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  approveBaselines,
  createImageDriver,
  type DiffraConfig,
  mergeReports,
  runVisualRegression,
  type TestRunReport,
  type VisualDriver,
  type VisualTarget,
} from '../../src/index.js';

/**
 * Drivers that produce their own images need no browser, so whole runs can be
 * exercised quickly: discovery, sharding, comparison, approval and merging.
 */

const SIZE = 12;
const solid = (value: number) =>
  encodePng(Buffer.alloc(SIZE * SIZE * 4, value), SIZE, SIZE);

function driverFor(
  name: string,
  targets: VisualTarget[],
  image: () => Buffer = () => solid(180),
): VisualDriver {
  return {
    name,
    discover: async () => targets,
    capture: async () => image(),
  };
}

describe('runs with custom drivers', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-drivers-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  function config(
    drivers: VisualDriver[],
    outputDir = path.join(dir, '.diffra'),
  ): Partial<DiffraConfig> {
    return {
      drivers,
      storage: { provider: 'local', outputDir },
      snapshot: { viewports: [{ width: SIZE, height: SIZE }] },
    };
  }

  it('compares an approved run by hash, with no pixel difference', async () => {
    const driver = driverFor('icons', [
      { id: 'icon--search', name: 'Search', group: 'Icons' },
    ]);

    const first = await runVisualRegression({
      cwd: dir,
      config: config([driver]),
    });
    expect(first.summary).toMatchObject({ added: 1, unchanged: 0 });

    const approved = await approveBaselines({
      cwd: dir,
      config: config([driver]),
      report: first,
    });
    expect(approved).toEqual({ count: 1, failed: 0 });

    const second = await runVisualRegression({
      cwd: dir,
      config: config([driver]),
    });
    expect(second.summary).toMatchObject({
      added: 0,
      changed: 0,
      unchanged: 1,
    });
    expect(second.results[0]?.status).toBe('unchanged');
    expect(second.results[0]?.diff?.diffCount).toBe(0);
  });

  it('reports a change when the driver produces a different image', async () => {
    let value = 120;
    const driver = driverFor(
      'icons',
      [{ id: 'icon--search', name: 'Search' }],
      () => solid(value),
    );
    const first = await runVisualRegression({
      cwd: dir,
      config: config([driver]),
    });
    await approveBaselines({
      cwd: dir,
      config: config([driver]),
      report: first,
    });

    value = 240;
    const second = await runVisualRegression({
      cwd: dir,
      config: config([driver]),
    });
    expect(second.summary.changed).toBe(1);
    expect(second.results[0]?.diff?.hasDiff).toBe(true);
  });

  it('runs several drivers together and reports every target once', async () => {
    const images = path.join(dir, 'images');
    await fs.mkdir(images, { recursive: true });
    await fs.writeFile(path.join(images, 'brand-logo.png'), solid(210));

    const report = await runVisualRegression({
      cwd: dir,
      config: config([
        createImageDriver({ dir: images }),
        driverFor('widgets', [
          { id: 'widget--counter', name: 'Counter', group: 'Widgets' },
        ]),
      ]),
    });

    const ids = report.results.map((r) => r.id).sort();
    expect(ids).toEqual(['image--brand-logo_png', 'widget--counter']);
    expect(report.summary).toMatchObject({ total: 2, added: 2, failed: 0 });
  });

  describe('sharding', () => {
    const targets: VisualTarget[] = ['a', 'b', 'c', 'd', 'e', 'f'].map(
      (id) => ({
        id: `target-${id}`,
        name: `Target ${id}`,
        group: 'Group',
      }),
    );

    async function runShard(index: number): Promise<TestRunReport> {
      return runVisualRegression({
        cwd: dir,
        shard: `${index}/3`,
        config: config(
          [driverFor('matrix', targets)],
          path.join(dir, `shard-${index}`),
        ),
      });
    }

    it('gives each shard a disjoint part and together covers every target', async () => {
      const shards = [await runShard(1), await runShard(2), await runShard(3)];
      const perShard = shards.map((s) => s.results.map((r) => r.id));

      expect(perShard.map((ids) => ids.length)).toEqual([2, 2, 2]);
      expect(perShard.flat().sort()).toEqual(targets.map((t) => t.id).sort());
    });

    it('merges the shard reports into one report with everything in it', async () => {
      const shards = [await runShard(1), await runShard(2), await runShard(3)];
      const outputDir = path.join(dir, 'merged');

      const merged = await mergeReports(shards, { outputDir });

      expect(merged.summary).toMatchObject({ total: 6, added: 6 });
      expect(merged.results).toHaveLength(6);
      await expect(
        fs.access(path.join(outputDir, 'report.json')),
      ).resolves.toBeUndefined();
    });
  });

  describe('mergeReports', () => {
    const single: TestRunReport = {
      runId: 'shard-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      git: { branch: 'main', commit: 'abc1234', baselineCommit: 'abc1234' },
      summary: {
        total: 1,
        passed: 1,
        changed: 0,
        added: 0,
        removed: 0,
        failed: 0,
        unchanged: 1,
      },
      results: [
        {
          id: 'test-1',
          name: 'Target 1',
          viewport: { width: 800, height: 600 },
          status: 'unchanged',
          candidate: {},
        },
      ],
    };

    it('refuses an empty list of reports', async () => {
      await expect(mergeReports([])).rejects.toThrow(/No valid shard reports/);
    });

    it('passes a single report through', async () => {
      const merged = await mergeReports([single]);
      expect(merged.results).toHaveLength(1);
      expect(merged.summary).toMatchObject({ total: 1, unchanged: 1 });
    });

    it('counts failed targets in the merged summary', async () => {
      const failed: TestRunReport = {
        ...single,
        runId: 'shard-2',
        results: single.results.map((r) => ({
          ...r,
          id: 'test-2',
          status: 'failed' as const,
        })),
      };
      const merged = await mergeReports([single, failed]);
      expect(merged.summary).toMatchObject({
        total: 2,
        failed: 1,
        unchanged: 1,
      });
    });
  });
});
