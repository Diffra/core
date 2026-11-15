import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { encodePng } from '@diffra/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  APPROVALS_FILE,
  approveBaselines,
  type DiffraConfig,
  readApprovals,
  runVisualRegression,
  type TestRunReport,
  type VisualDriver,
} from '../../src/index.js';

const SIZE = 12;
const image = encodePng(Buffer.alloc(SIZE * SIZE * 4, 180), SIZE, SIZE);

const driver: VisualDriver = {
  name: 'icons',
  discover: async () => [
    { id: 'icon--search', name: 'Search', group: 'Icons' },
    { id: 'icon--close', name: 'Close', group: 'Icons' },
  ],
  capture: async () => image,
};

describe('approval record', () => {
  let dir: string;
  let outputDir: string;
  let config: Partial<DiffraConfig>;
  let report: TestRunReport;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-approvals-'));
    outputDir = path.join(dir, '.diffra');
    config = {
      drivers: [driver],
      storage: { provider: 'local', outputDir },
      snapshot: { viewports: [{ width: SIZE, height: SIZE }] },
    };
    report = await runVisualRegression({ cwd: dir, config });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes one record for an approval of chosen snapshots', async () => {
    const result = await approveBaselines({
      cwd: dir,
      config,
      report,
      ids: ['icon--search'],
    });
    expect(result).toEqual({ count: 1, failed: 0 });

    const records = await readApprovals(path.join(outputDir, APPROVALS_FILE));
    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record?.runId).toBe(report.runId);
    expect(typeof record?.commit).toBe('string');
    expect(new Date(record?.at ?? '').toISOString()).toBe(record?.at);
    expect(record?.snapshots).toEqual([
      {
        id: 'icon--search',
        browser: 'chromium',
        viewport: { width: SIZE, height: SIZE },
        status: 'added',
      },
    ]);
  });

  it('records a person as the default actor, without a rationale', async () => {
    await approveBaselines({ cwd: dir, config, report });
    const text = await fs.readFile(
      path.join(outputDir, APPROVALS_FILE),
      'utf-8',
    );
    expect(text.trim().split('\n')).toHaveLength(1);
    const [record] = await readApprovals(path.join(outputDir, APPROVALS_FILE));
    expect(record?.actor).toBe('human');
    expect(record).not.toHaveProperty('rationale');
    expect(record?.snapshots.map((s) => s.id).sort()).toEqual([
      'icon--close',
      'icon--search',
    ]);
  });

  it('stores the actor and the rationale', async () => {
    await approveBaselines({
      cwd: dir,
      config,
      report,
      provenance: { actor: 'agent', rationale: 'The icons were redrawn.' },
    });
    const [record] = await readApprovals(path.join(outputDir, APPROVALS_FILE));
    expect(record?.actor).toBe('agent');
    expect(record?.rationale).toBe('The icons were redrawn.');
  });

  it('records the classification and the proof of each snapshot', async () => {
    const first = report.results[0];
    if (!first) throw new Error('expected a result');
    const classified: TestRunReport = {
      ...report,
      results: [
        {
          ...first,
          classification: { kind: 'intended', reason: 'declared' },
          explanation: {
            proof: { status: 'proven', note: '', reverted: 1 },
          } as unknown as NonNullable<typeof first.explanation>,
        },
      ],
    };
    await approveBaselines({ cwd: dir, config, report: classified });
    const [record] = await readApprovals(path.join(outputDir, APPROVALS_FILE));
    expect(record?.snapshots[0]).toMatchObject({
      classification: 'intended',
      proof: 'proven',
    });
  });

  it('appends a line for every approval', async () => {
    await approveBaselines({ cwd: dir, config, report, ids: ['icon--search'] });
    await approveBaselines({ cwd: dir, config, report, ids: ['icon--close'] });
    const records = await readApprovals(path.join(outputDir, APPROVALS_FILE));
    expect(records.map((r) => r.snapshots[0]?.id)).toEqual([
      'icon--search',
      'icon--close',
    ]);
  });

  it('writes nothing when nothing is approved', async () => {
    const empty: TestRunReport = { ...report, results: [] };
    const result = await approveBaselines({ cwd: dir, config, report: empty });
    expect(result).toEqual({ count: 0, failed: 0 });
    await expect(
      fs.access(path.join(outputDir, APPROVALS_FILE)),
    ).rejects.toThrow();
    expect(await readApprovals(path.join(outputDir, APPROVALS_FILE))).toEqual(
      [],
    );
  });
});
