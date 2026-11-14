import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  approveBaselines,
  loadConfig,
  runVisualRegression,
} from '../../src/index.js';
import type {
  DiffraConfig,
  SnapshotKey,
  StorageAdapter,
  TestRunReport,
} from '../../src/types/index.js';

const VIEWPORT = { width: 400, height: 300 };
const BASE_BRANCH = 'main';

/**
 * Strict in-memory adapter that behaves like a remote object store: baselines
 * are only found under the exact commit they were stored for, and candidate
 * locations are opaque URLs that cannot be read from the local filesystem.
 */
class MemoryStorage implements StorageAdapter {
  name = 'memory';
  readonly baselines = new Map<string, Buffer>();
  private readonly candidates = new Map<string, Buffer>();

  private id(key: SnapshotKey): string {
    return `${key.targetId}--${key.browser}--${key.viewport.width}x${key.viewport.height}`;
  }

  async uploadCandidate(
    runId: string,
    key: SnapshotKey,
    buffer: Buffer,
  ): Promise<string> {
    this.candidates.set(`${runId}/${this.id(key)}`, buffer);
    return `memory://runs/${runId}/candidates/${this.id(key)}`;
  }

  async downloadCandidate(
    runId: string,
    key: SnapshotKey,
  ): Promise<Buffer | null> {
    return this.candidates.get(`${runId}/${this.id(key)}`) ?? null;
  }

  async uploadDiff(
    runId: string,
    key: SnapshotKey,
    _buffer: Buffer,
  ): Promise<string> {
    return `memory://runs/${runId}/diffs/${this.id(key)}`;
  }

  async downloadBaseline(
    commit: string,
    key: SnapshotKey,
  ): Promise<Buffer | null> {
    return this.baselines.get(`${commit}/${this.id(key)}`) ?? null;
  }

  async uploadBaseline(
    commit: string,
    key: SnapshotKey,
    buffer: Buffer,
  ): Promise<void> {
    this.baselines.set(`${commit}/${this.id(key)}`, buffer);
  }

  async saveReport(report: TestRunReport): Promise<string> {
    return `memory://runs/${report.runId}/report.json`;
  }
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

function pageHtml(color: string): string {
  return `<!doctype html><html><body style="margin:0"><div style="width:${VIEWPORT.width}px;height:${VIEWPORT.height}px;background:${color}"></div></body></html>`;
}

// Each scenario launches Chromium up to three times, which can exceed the
// default timeout when the whole suite runs in parallel.
const SCENARIO_TIMEOUT_MS = 60_000;

describe('visual regression loop', { timeout: SCENARIO_TIMEOUT_MS }, () => {
  let repoDir: string;
  let server: http.Server;
  let baseUrl: string;
  let deadUrl: string;
  const pageColors = new Map<string, string>();

  async function listen(handler?: http.RequestListener) {
    const instance = http.createServer(handler);
    await new Promise<void>((resolve) => {
      instance.listen(0, resolve);
    });
    const { port } = instance.address() as AddressInfo;
    return { instance, port };
  }

  beforeEach(async () => {
    repoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-loop-'));
    git(repoDir, 'init', '-b', BASE_BRANCH);
    git(repoDir, 'config', 'user.email', 'loop@test.invalid');
    git(repoDir, 'config', 'user.name', 'Loop Test');
    git(repoDir, 'config', 'commit.gpgsign', 'false');
    git(repoDir, 'commit', '--allow-empty', '-m', 'initial');

    pageColors.clear();
    pageColors.set('/a', '#2255cc');
    pageColors.set('/b', '#22cc55');

    const live = await listen((req, res) => {
      const color = pageColors.get(req.url ?? '');
      if (!color) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(pageHtml(color));
    });
    server = live.instance;
    baseUrl = `http://localhost:${live.port}`;

    // A port that was bound and released, so connections are refused.
    const dead = await listen();
    deadUrl = `http://localhost:${dead.port}/unreachable`;
    await new Promise<void>((resolve) => dead.instance.close(() => resolve()));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(repoDir, { recursive: true, force: true });
  });

  function config(
    overrides: Partial<DiffraConfig> = {},
    urls: Array<string | { url: string; name?: string }> = ['/a', '/b'],
  ): Partial<DiffraConfig> {
    return {
      drivers: { driver: 'url', baseUrl, urls },
      snapshot: { viewports: [VIEWPORT], delay: 0 },
      runner: { concurrency: 2, baselineBranch: BASE_BRANCH },
      ...overrides,
    };
  }

  function statusById(report: TestRunReport): Record<string, string> {
    return Object.fromEntries(report.results.map((r) => [r.id, r.status]));
  }

  it('moves from added to unchanged to changed across approve cycles', async () => {
    const first = await runVisualRegression({
      cwd: repoDir,
      config: config(),
    });
    expect(statusById(first)).toEqual({
      'route--a': 'added',
      'route--b': 'added',
    });

    const approved = await approveBaselines({ cwd: repoDir, report: first });
    expect(approved.count).toBe(2);

    const second = await runVisualRegression({
      cwd: repoDir,
      config: config(),
    });
    expect(statusById(second)).toEqual({
      'route--a': 'unchanged',
      'route--b': 'unchanged',
    });

    pageColors.set('/a', '#cc2255');
    const third = await runVisualRegression({
      cwd: repoDir,
      config: config(),
    });
    expect(statusById(third)).toEqual({
      'route--a': 'changed',
      'route--b': 'unchanged',
    });
    const changed = third.results.find((r) => r.id === 'route--a');
    expect(changed?.diff?.boundingBoxes.length).toBeGreaterThan(0);
    expect(changed?.diffImage?.path).toBeDefined();
    expect(third.summary).toMatchObject({ changed: 1, unchanged: 1 });
  });

  it('writes a self-contained review bundle with relative image URLs', async () => {
    const first = await runVisualRegression({ cwd: repoDir, config: config() });
    await approveBaselines({ cwd: repoDir, report: first });
    pageColors.set('/a', '#cc2255');

    const report = await runVisualRegression({
      cwd: repoDir,
      config: config(),
    });
    const dir = report.reviewDir;

    for (const file of [
      'index.html',
      'report.json',
      'viewer.bundle.js',
      'viewer.css',
    ]) {
      await expect(fs.access(path.join(dir, file))).resolves.toBeUndefined();
    }

    const changed = report.results.find((r) => r.id === 'route--a');
    const unchanged = report.results.find((r) => r.id === 'route--b');
    for (const image of [
      changed?.candidate,
      changed?.baseline,
      changed?.diffImage,
    ]) {
      expect(image?.url).toMatch(/^images\/[0-9a-f]{64}\.png$/);
      const bytes = await fs.readFile(path.join(dir, image?.url ?? 'missing'));
      expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    }
    // Targets that need no review carry no images, which keeps bundles small.
    expect(unchanged?.candidate.url).toBeUndefined();

    // The shared copies name no local storage locations.
    const shared = await fs.readFile(path.join(dir, 'report.json'), 'utf-8');
    const page = await fs.readFile(path.join(dir, 'index.html'), 'utf-8');
    expect(shared).not.toContain(repoDir);
    expect(page).not.toContain(repoDir);
    expect(page).toContain('id="diffra-data"');
    expect(page).toContain('images/');
  });

  it('links the hosted review page when reportBaseUrl is configured', async () => {
    const report = await runVisualRegression({
      cwd: repoDir,
      config: config({ reportBaseUrl: 'https://reports.example.test/diffra/' }),
    });

    expect(report.links?.review).toBe(
      `https://reports.example.test/diffra/runs/${report.runId}/`,
    );
  });

  it('fails one target instead of the run when its comparison throws', async () => {
    class FlakyStorage extends MemoryStorage {
      override async uploadCandidate(
        runId: string,
        key: SnapshotKey,
        buffer: Buffer,
      ): Promise<string> {
        if (key.targetId === 'route--b') {
          throw new Error('bucket unavailable');
        }
        return super.uploadCandidate(runId, key, buffer);
      }
    }
    const steps: [number, number][] = [];

    const report = await runVisualRegression({
      cwd: repoDir,
      config: config({ storage: new FlakyStorage() }),
      onProgress: (_step, current, total) => steps.push([current, total]),
    });

    expect(statusById(report)).toEqual({
      'route--a': 'added',
      'route--b': 'failed',
    });
    const failed = report.results.find((r) => r.id === 'route--b');
    expect(failed?.error).toContain('bucket unavailable');
    expect(report.summary.failed).toBe(1);
    // Progress covers every target, and the total is the number of targets.
    expect(steps).toHaveLength(2);
    expect(steps.every(([, total]) => total === 2)).toBe(true);
    expect(steps.at(-1)?.[0]).toBe(2);
  });

  it('lists results in a stable order', async () => {
    const report = await runVisualRegression({
      cwd: repoDir,
      config: config({}, ['/b', '/a']),
    });
    expect(report.results.map((r) => r.id)).toEqual(['route--a', 'route--b']);
  });

  describe('removed targets', () => {
    it('reports a target that no longer exists, with its baseline image', async () => {
      const first = await runVisualRegression({
        cwd: repoDir,
        config: config(),
      });
      await approveBaselines({ cwd: repoDir, report: first });

      const second = await runVisualRegression({
        cwd: repoDir,
        config: config({}, ['/a']),
      });

      expect(statusById(second)).toEqual({
        'route--a': 'unchanged',
        'route--b': 'removed',
      });
      expect(second.summary).toMatchObject({ removed: 1, unchanged: 1 });
      const removed = second.results.find((r) => r.id === 'route--b');
      expect(removed?.baseline?.url).toMatch(/^images\/[0-9a-f]{64}\.png$/);
    });

    it('stops reporting it once the new run is approved', async () => {
      const first = await runVisualRegression({
        cwd: repoDir,
        config: config(),
      });
      await approveBaselines({ cwd: repoDir, report: first });
      const second = await runVisualRegression({
        cwd: repoDir,
        config: config({}, ['/a']),
      });

      // Approving a run that contains a removed target must not fail on it.
      const approved = await approveBaselines({ cwd: repoDir, report: second });
      expect(approved).toEqual({ count: 1, failed: 0 });

      const third = await runVisualRegression({
        cwd: repoDir,
        config: config({}, ['/a']),
      });
      expect(statusById(third)).toEqual({ 'route--a': 'unchanged' });
    });

    it('does not guess from a shard, which sees only part of the targets', async () => {
      const first = await runVisualRegression({
        cwd: repoDir,
        config: config(),
      });
      await approveBaselines({ cwd: repoDir, report: first });

      const shard = await runVisualRegression({
        cwd: repoDir,
        shard: '1/2',
        config: config(),
      });

      expect(shard.shard).toBe('1/2');
      expect(shard.summary.removed).toBe(0);
      expect(shard.results.map((r) => r.id)).toEqual(['route--a']);
    });

    it('is not reported for storage that cannot list a baseline', async () => {
      // MemoryStorage has no list of promoted snapshots.
      const storage = new MemoryStorage();
      const first = await runVisualRegression({
        cwd: repoDir,
        config: config({ storage }),
      });
      await approveBaselines({
        cwd: repoDir,
        config: config({ storage }),
        report: first,
      });

      const second = await runVisualRegression({
        cwd: repoDir,
        config: config({ storage }, ['/a']),
      });
      expect(second.summary.removed).toBe(0);
    });
  });

  it('keeps a custom storage adapter instance when loading config', async () => {
    const storage = new MemoryStorage();
    const loaded = await loadConfig(repoDir, { storage });
    expect(loaded.storage).toBe(storage);
  });

  it('reports a failed capture as a failed result instead of dropping it', async () => {
    const report = await runVisualRegression({
      cwd: repoDir,
      config: config({}, ['/a', { url: deadUrl, name: 'Unreachable' }]),
    });

    expect(report.results).toHaveLength(2);
    const failed = report.results.find((r) => r.id === 'route--unreachable');
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toEqual(expect.any(String));
    expect(report.summary.failed).toBe(1);
    expect(report.summary.total).toBe(2);
  });

  it('approves baselines through the storage adapter when candidates are not local files', async () => {
    const storage = new MemoryStorage();
    const report = await runVisualRegression({
      cwd: repoDir,
      config: config({ storage }),
    });
    expect(report.results.every((r) => r.status === 'added')).toBe(true);

    const approved = await approveBaselines({
      cwd: repoDir,
      config: config({ storage }),
      report,
    });

    expect(approved.count).toBe(2);
    expect(storage.baselines.size).toBe(2);
  });

  it('falls back to an ancestor baseline when the merge-base commit has none', async () => {
    const storage = new MemoryStorage();
    const seeded = await runVisualRegression({
      cwd: repoDir,
      config: config({ storage }),
    });
    await approveBaselines({
      cwd: repoDir,
      config: config({ storage }),
      report: seeded,
    });
    expect(storage.baselines.size).toBe(2);

    // The default branch moves on without a visual run, then a feature branch
    // forks from it, so the merge-base commit never received baselines.
    git(repoDir, 'commit', '--allow-empty', '-m', 'main moves on');
    git(repoDir, 'switch', '-c', 'feature');
    git(repoDir, 'commit', '--allow-empty', '-m', 'feature work');

    const report = await runVisualRegression({
      cwd: repoDir,
      config: config({ storage }),
    });

    expect(statusById(report)).toEqual({
      'route--a': 'unchanged',
      'route--b': 'unchanged',
    });
  });

  it('compares a default branch run against the previous baseline', async () => {
    const storage = new MemoryStorage();
    const seeded = await runVisualRegression({
      cwd: repoDir,
      config: config({ storage }),
    });
    await approveBaselines({
      cwd: repoDir,
      config: config({ storage }),
      report: seeded,
    });
    expect(storage.baselines.size).toBe(2);

    // On the default branch the merge-base is HEAD itself, which has no
    // baseline yet; the previous commit's baseline is the right comparison.
    git(repoDir, 'commit', '--allow-empty', '-m', 'next change on main');
    pageColors.set('/a', '#cc2255');

    const report = await runVisualRegression({
      cwd: repoDir,
      config: config({ storage }),
    });

    expect(statusById(report)).toEqual({
      'route--a': 'changed',
      'route--b': 'unchanged',
    });
  });
});
