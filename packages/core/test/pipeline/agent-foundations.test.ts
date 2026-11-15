import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { encodePng } from '@diffra/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  approveBaselines,
  type DiffraConfig,
  runVisualRegression,
  type VisualDriver,
  type VisualTarget,
} from '../../src/index.js';
import { reportablePath } from '../../src/pipeline/compare.js';
import { matchesFilter } from '../../src/pipeline/plan.js';

const SIZE = 12;
const solid = (value: number) =>
  encodePng(Buffer.alloc(SIZE * SIZE * 4, value), SIZE, SIZE);

const SEARCH: VisualTarget = {
  id: 'icon--search',
  name: 'Search',
  group: 'Icons',
  filePath: './src/icons/search.stories.tsx',
};
const CLOSE: VisualTarget = {
  id: 'icon--close',
  name: 'Close',
  group: 'Icons',
};

function driverOf(targets: VisualTarget[]): VisualDriver {
  return {
    name: 'icons',
    discover: async () => targets,
    capture: async () => solid(150),
  };
}

describe('matchesFilter', () => {
  it('matches the id, name or group, ignoring case', () => {
    expect(matchesFilter(SEARCH, 'SEARCH')).toBe(true);
    expect(matchesFilter(SEARCH, 'icons')).toBe(true);
    expect(matchesFilter(SEARCH, 'close')).toBe(false);
  });

  it('matches everything when there is no filter', () => {
    expect(matchesFilter(SEARCH, undefined)).toBe(true);
    expect(matchesFilter(SEARCH, '  ')).toBe(true);
  });
});

describe('foundations for agents', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-foundations-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  function config(
    driver: VisualDriver,
    extra: Partial<DiffraConfig> = {},
  ): Partial<DiffraConfig> {
    return {
      drivers: [driver],
      storage: { provider: 'local', outputDir: path.join(dir, '.diffra') },
      snapshot: { viewports: [{ width: SIZE, height: SIZE }] },
      ...extra,
    };
  }

  it('carries the source file of a target into its result', async () => {
    const report = await runVisualRegression({
      cwd: dir,
      config: config(driverOf([SEARCH, CLOSE])),
    });
    expect(report.results.find((r) => r.id === SEARCH.id)?.filePath).toBe(
      SEARCH.filePath,
    );
    expect(report.results.find((r) => r.id === CLOSE.id)).not.toHaveProperty(
      'filePath',
    );
  });

  it('never writes request credentials into the report or the bundle', async () => {
    const secret = 'hunter2-secret';
    const target: VisualTarget = {
      ...SEARCH,
      request: {
        headers: { Authorization: `Bearer ${secret}` },
        auth: { username: 'admin', password: secret },
        cookies: [{ name: 'session', value: secret }],
      },
      metadata: { note: 'public' },
    };
    const report = await runVisualRegression({
      cwd: dir,
      config: config(driverOf([target])),
    });

    expect(JSON.stringify(report)).not.toContain(secret);
    expect(report.results[0]?.metadata).toEqual({ note: 'public' });
    const written = await fs.readFile(
      path.join(report.reviewDir, 'report.json'),
      'utf-8',
    );
    expect(written).not.toContain(secret);
  });

  it('runs only the targets that match the filter and does not report the rest as removed', async () => {
    const driver = driverOf([SEARCH, CLOSE]);
    const first = await runVisualRegression({
      cwd: dir,
      config: config(driver),
    });
    await approveBaselines({ cwd: dir, config: config(driver), report: first });

    const filtered = await runVisualRegression({
      cwd: dir,
      config: config(driver, { runner: { concurrency: 1, filter: 'search' } }),
    });
    expect(filtered.filter).toBe('search');
    expect(filtered.results.map((r) => r.id)).toEqual([SEARCH.id]);
    expect(filtered.summary.removed).toBe(0);
  });

  it('approves only the chosen snapshots', async () => {
    const driver = driverOf([SEARCH, CLOSE]);
    const first = await runVisualRegression({
      cwd: dir,
      config: config(driver),
    });

    const approved = await approveBaselines({
      cwd: dir,
      config: config(driver),
      report: first,
      ids: [SEARCH.id],
    });
    expect(approved).toEqual({ count: 1, failed: 0 });

    const second = await runVisualRegression({
      cwd: dir,
      config: config(driver),
    });
    const status = (id: string) =>
      second.results.find((r) => r.id === id)?.status;
    expect(status(SEARCH.id)).toBe('unchanged');
    expect(status(CLOSE.id)).toBe('added');
  });

  it('refuses to approve an id that is not in the run', async () => {
    const driver = driverOf([SEARCH]);
    const first = await runVisualRegression({
      cwd: dir,
      config: config(driver),
    });
    await expect(
      approveBaselines({
        cwd: dir,
        config: config(driver),
        report: first,
        ids: ['icon--missing'],
      }),
    ).rejects.toThrow(/icon--missing/);
  });

  it('calls the onBeforeCapture hook for every target, and fails a target whose hook throws', async () => {
    const seen: string[] = [];
    const report = await runVisualRegression({
      cwd: dir,
      config: config(driverOf([SEARCH, CLOSE]), {
        plugins: [
          {
            name: 'before',
            onBeforeCapture: (target) => {
              seen.push(target.id);
              if (target.id === CLOSE.id) throw new Error('not ready');
            },
          },
        ],
      }),
    });

    expect(seen.sort()).toEqual([CLOSE.id, SEARCH.id]);
    expect(report.results.find((r) => r.id === SEARCH.id)?.status).toBe(
      'added',
    );
    const closed = report.results.find((r) => r.id === CLOSE.id);
    expect(closed?.status).toBe('failed');
    expect(closed?.error).toMatch(/not ready/);
  });
});

describe('reportablePath', () => {
  it('keeps relative paths, relativizes project paths, and hides other machine paths', () => {
    const cwd = path.resolve('/work/project');
    expect(reportablePath('./src/a.stories.tsx', cwd)).toBe(
      './src/a.stories.tsx',
    );
    expect(reportablePath(path.join(cwd, 'imgs', 'a.png'), cwd)).toBe(
      'imgs/a.png',
    );
    expect(reportablePath(path.resolve('/elsewhere/secret/a.png'), cwd)).toBe(
      'a.png',
    );
  });
});
