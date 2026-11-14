import type { BaselineResolver } from '../baselines.js';
import { snapshotId } from '../baselines.js';
import type { ReviewBundle } from '../report/bundle.js';
import type { StorageAdapter, VisualTestResult } from '../types/index.js';
import { sha256Hex } from '../utils/hash.js';
import { UNGROUPED } from './compare.js';

/**
 * Finds snapshots that have a baseline but no result in this run, because the
 * target no longer exists (or no longer has that viewport or browser). Needs a
 * storage adapter that can list what a baseline commit contains, and a run that
 * saw every target, so it returns nothing otherwise.
 */
export async function findRemoved(options: {
  storage: StorageAdapter;
  baselines: BaselineResolver;
  bundle: ReviewBundle;
  results: VisualTestResult[];
}): Promise<VisualTestResult[]> {
  const { storage, baselines, bundle, results } = options;
  const commit = baselines.resolvedCommit();
  if (!commit || !storage.downloadBaselineKeys) return [];

  const expected = await storage.downloadBaselineKeys(commit);
  if (!expected) return [];

  const seen = new Set(
    results.map((r) =>
      snapshotId({ targetId: r.id, viewport: r.viewport, browser: r.browser }),
    ),
  );

  const removed: VisualTestResult[] = [];
  for (const key of expected) {
    if (seen.has(snapshotId(key))) continue;
    const baseline = await storage.downloadBaseline(commit, key);
    removed.push({
      id: key.targetId,
      name: key.targetId,
      group: UNGROUPED,
      viewport: key.viewport,
      browser: key.browser,
      status: 'removed',
      candidate: {},
      baseline: baseline
        ? { hash: sha256Hex(baseline), url: await bundle.addImage(baseline) }
        : undefined,
    });
  }
  return removed;
}
