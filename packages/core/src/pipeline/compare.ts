import path from 'node:path';
import type { BaselineResolver } from '../baselines.js';
import type {
  CaptureFailure,
  CaptureResult,
} from '../capture/screenshot-runner.js';
import { DEFAULT_DIFF_THRESHOLD } from '../config/schema.js';
import type { ReviewBundle } from '../report/bundle.js';
import type {
  DiffEngineAdapter,
  DiffResult,
  DiffraConfig,
  Project,
  SnapshotKey,
  StorageAdapter,
  Viewport,
  VisualTarget,
  VisualTestResult,
} from '../types/index.js';
import { sha256Hex } from '../utils/hash.js';
import { explainChange } from './explain.js';
import { loadLedger, storeLedger } from './ledgers.js';
import { DEFAULT_BROWSER } from './plan.js';

/** Group name for targets whose driver did not assign one. */
export const UNGROUPED = 'General';

export interface CompareContext {
  runId: string;
  /** The project directory, which source paths in the report are relative to. */
  cwd: string;
  /** Files that differ from the baseline commit, to tell whether a cause is in this branch. */
  changedFiles?: string[];
  config: DiffraConfig;
  storage: StorageAdapter;
  diffEngine: DiffEngineAdapter;
  baselines: BaselineResolver;
  bundle: ReviewBundle;
}

export function browserOf(project?: Project): string {
  return project?.browser || project?.name || DEFAULT_BROWSER;
}

/**
 * A source path as it appears in a report: relative to the project and never
 * an address on the machine that ran the tests. A file outside the project is
 * reduced to its name.
 */
export function reportablePath(filePath: string, cwd: string): string {
  if (!path.isAbsolute(filePath)) return filePath;
  const relative = path.relative(cwd, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return path.basename(filePath);
  }
  return relative.split(path.sep).join('/');
}

/** The fields every result shares, whatever its status. */
function identify(
  target: VisualTarget,
  viewport: Viewport,
  project: Project | undefined,
  cwd: string,
): Pick<
  VisualTestResult,
  'id' | 'name' | 'group' | 'viewport' | 'browser' | 'filePath' | 'metadata'
> {
  return {
    id: target.id,
    name: target.name,
    group: target.group || UNGROUPED,
    viewport,
    browser: browserOf(project),
    ...(target.filePath
      ? { filePath: reportablePath(target.filePath, cwd) }
      : {}),
    metadata: target.metadata,
  };
}

/** The result recorded for a target that produced no image. */
export function failedResult(
  failure: CaptureFailure,
  cwd: string,
): VisualTestResult {
  return {
    ...identify(failure.target, failure.viewport, failure.project, cwd),
    status: 'failed',
    candidate: {},
    error: failure.error,
  };
}

/**
 * Compares one captured image with its baseline. Identical hashes skip the
 * pixel comparison entirely.
 */
export async function compareCapture(
  ctx: CompareContext,
  capture: CaptureResult,
): Promise<VisualTestResult> {
  const { target, viewport, project, buffer } = capture;
  const { runId, cwd, config, storage, diffEngine, baselines, bundle } = ctx;
  const base = identify(target, viewport, project, cwd);

  const key: SnapshotKey = {
    targetId: target.id,
    viewport,
    browser: base.browser,
  };
  const candidateHash = sha256Hex(buffer);
  const candidatePath = await storage.uploadCandidate(runId, key, buffer);
  const candidateLedger = await storeLedger(
    storage,
    bundle,
    candidateHash,
    capture.ledger,
  );
  const baselineBuffer = await baselines.find(key);

  if (!baselineBuffer) {
    return {
      ...base,
      status: 'added',
      candidate: {
        path: candidatePath,
        hash: candidateHash,
        url: await bundle.addImage(buffer),
      },
      ...(candidateLedger ? { ledgers: { candidate: candidateLedger } } : {}),
    };
  }

  const baselineHash = sha256Hex(baselineBuffer);
  const unchanged = (diff: VisualTestResult['diff']): VisualTestResult => ({
    ...base,
    status: 'unchanged',
    diff,
    baseline: { hash: baselineHash },
    candidate: { path: candidatePath, hash: candidateHash },
  });

  if (candidateHash === baselineHash) {
    return unchanged({
      diffCount: 0,
      diffPercentage: 0,
      isSameDimensions: true,
      width: viewport.width,
      height: viewport.height,
      boundingBoxes: [],
      hasDiff: false,
    });
  }

  const diffThreshold =
    target.snapshot?.diffThreshold ??
    config.snapshot?.diffThreshold ??
    DEFAULT_DIFF_THRESHOLD;
  let diff: DiffResult;
  try {
    diff = await diffEngine.compare(baselineBuffer, buffer, {
      threshold: diffThreshold,
      diffThreshold,
      generateDiffImage: true,
    });
  } catch (err) {
    // An image that cannot be decoded fails this snapshot, not the whole run.
    return {
      ...base,
      status: 'failed',
      candidate: { path: candidatePath, hash: candidateHash },
      error: `Comparison failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // The diff image is stored as a file of its own. Leaving its bytes on the
  // result would write them into every copy of the report, as a JSON array of
  // numbers, and keep them in memory until the run ends.
  const { diffImage: diffPng, ...summary } = diff;

  if (!summary.hasDiff) {
    return unchanged(summary);
  }

  const diffPath = diffPng
    ? await storage.uploadDiff(runId, key, diffPng)
    : undefined;
  const baselineLedger = await loadLedger(storage, bundle, baselineHash);
  return {
    ...base,
    status: 'changed',
    diff: summary,
    baseline: {
      hash: baselineHash,
      url: await bundle.addImage(baselineBuffer),
    },
    candidate: {
      path: candidatePath,
      hash: candidateHash,
      url: await bundle.addImage(buffer),
    },
    diffImage: diffPng
      ? { path: diffPath, url: await bundle.addImage(diffPng) }
      : undefined,
    ...(candidateLedger || baselineLedger
      ? {
          ledgers: {
            ...(baselineLedger ? { baseline: baselineLedger.url } : {}),
            ...(candidateLedger ? { candidate: candidateLedger } : {}),
          },
        }
      : {}),
    ...(baselineLedger && capture.ledger
      ? {
          explanation: explainChange({
            baseline: baselineLedger.ledger,
            candidate: capture.ledger,
            regions: summary.boundingBoxes,
            changedFiles: ctx.changedFiles,
          }),
        }
      : {}),
  };
}
