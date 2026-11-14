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
} from '../src/index.js';
import type {
  DiffraConfig,
  SnapshotKey,
  StorageAdapter,
  TestRunReport,
} from '../src/types/index.js';

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

describe('visual regression loop', () => {
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
