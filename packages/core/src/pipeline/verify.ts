import { loadConfig } from '../config/loader.js';
import type { RunOptions, RunResult } from '../index.js';
import { runVisualRegression } from '../index.js';
import type { TestRunReport, VisualTestResult } from '../types/index.js';
import { type AffectedSelection, selectAffected } from './affected.js';
import { loadRunReport } from './approve.js';

export interface SnapshotRef {
  id: string;
  browser?: string;
  viewport: { width: number; height: number };
}

/** What a run changed about the changes that were open before it. */
export interface Verification {
  /** Changed or failed before, unchanged now. */
  resolved: SnapshotRef[];
  /** Changed or failed before, and not unchanged now: still changed, or now failed, removed or added. */
  stillChanged: SnapshotRef[];
  /** Not changed before, and changed, added, removed or failed now. */
  newlyChanged: SnapshotRef[];
  /** Open before, but not captured in this run, so nothing is known about them. */
  notChecked: SnapshotRef[];
  /** In words. */
  summary: string;
}

const OPEN = new Set(['changed', 'failed']);
const NEEDS_DECISION = new Set(['changed', 'added', 'removed', 'failed']);

const keyOf = (r: VisualTestResult) =>
  `${r.id}|${r.browser ?? ''}|${r.viewport.width}x${r.viewport.height}`;

const refOf = (r: VisualTestResult): SnapshotRef => ({
  id: r.id,
  browser: r.browser,
  viewport: { width: r.viewport.width, height: r.viewport.height },
});

/** Compares two runs of the same project. Pure, so it can be tested without a browser. */
export function compareRuns(
  previous: TestRunReport | undefined,
  current: TestRunReport,
): Verification {
  const before = new Map((previous?.results ?? []).map((r) => [keyOf(r), r]));
  const now = new Map(current.results.map((r) => [keyOf(r), r]));

  const resolved: SnapshotRef[] = [];
  const stillChanged: SnapshotRef[] = [];
  const newlyChanged: SnapshotRef[] = [];
  const notChecked: SnapshotRef[] = [];

  for (const [key, result] of now) {
    const was = before.get(key);
    const wasOpen = was ? OPEN.has(was.status) : false;
    if (wasOpen && result.status === 'unchanged') resolved.push(refOf(result));
    else if (wasOpen) {
      // Still changed, or now failed or gone: either way it is not resolved.
      stillChanged.push(refOf(result));
    } else if (!wasOpen && NEEDS_DECISION.has(result.status)) {
      // A snapshot that was new in the last run and still is, has not changed.
      if (!(was?.status === 'added' && result.status === 'added')) {
        newlyChanged.push(refOf(result));
      }
    }
  }
  for (const [key, was] of before) {
    if (OPEN.has(was.status) && !now.has(key)) notChecked.push(refOf(was));
  }

  const part = (n: number, text: string) => (n > 0 ? [`${n} ${text}`] : []);
  const parts = [
    ...part(resolved.length, 'resolved'),
    ...part(stillChanged.length, 'still changed'),
    ...part(newlyChanged.length, 'newly changed'),
    ...part(notChecked.length, 'not checked in this run'),
  ];
  return {
    resolved,
    stillChanged,
    newlyChanged,
    notChecked,
    summary:
      parts.length > 0
        ? `${parts.join(', ')}.`
        : 'Nothing was open before this run, and nothing changed in it.',
  };
}

export interface VerifyOptions extends RunOptions {
  /** Capture only the snapshots that the changed files are known to reach. */
  affected?: boolean;
}

export interface VerifyResult {
  report: RunResult;
  verification: Verification;
  /** What was selected, when `affected` was asked for. */
  affected?: AffectedSelection & { ran: 'affected' | 'everything' };
}

/**
 * Runs again after a change and says what became of the changes that were open
 * before: which are resolved, which remain, and which are new.
 */
export async function verifyRun(options: VerifyOptions): Promise<VerifyResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd, options.config, options.configFile);
  let previous: TestRunReport | undefined;
  try {
    previous = await loadRunReport(config, cwd);
  } catch {}

  let selection: VerifyResult['affected'];
  let only: string[] | undefined;
  if (options.affected) {
    const chosen = await selectAffected(options);
    only =
      chosen.basis === 'ledgers' && chosen.ids.length > 0
        ? chosen.ids
        : undefined;
    selection = { ...chosen, ran: only ? 'affected' : 'everything' };
  }

  const report = await runVisualRegression({ ...options, only });
  return {
    report,
    verification: compareRuns(previous, report),
    affected: selection,
  };
}
