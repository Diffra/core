import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { getGitInfo } from '../git/baseline.js';
import { resolveStorageAdapter } from '../plugins/storage/index.js';
import { resolveOutputDir } from '../report/bundle.js';
import { isTestRunReport } from '../report/generator.js';
import type {
  DiffraConfig,
  SnapshotKey,
  SnapshotStatus,
  TestRunReport,
  VisualTestResult,
} from '../types/index.js';

/** The log of approvals, one JSON record per line, kept in the output directory. */
export const APPROVALS_FILE = 'approvals.jsonl';

/** Who made an approval and why. */
export interface ApprovalProvenance {
  actor: 'human' | 'agent';
  rationale?: string;
}

/** One approved snapshot, as recorded. */
export interface ApprovedSnapshot {
  id: string;
  browser?: string;
  viewport: { width: number; height: number };
  status: SnapshotStatus;
  /** Whether the change was declared beforehand, when intents were declared. */
  classification?: 'intended' | 'collateral';
  /** The outcome of proving the change, when it was proven. */
  proof?: 'proven' | 'unproven' | 'not-attempted';
}

/** One line of the approvals log: a single approval of one or more snapshots. */
export interface ApprovalRecord {
  at: string;
  actor: 'human' | 'agent';
  rationale?: string;
  runId: string;
  /** The commit the baselines were promoted for. */
  commit: string;
  snapshots: ApprovedSnapshot[];
}

/** Reads the approvals log. A missing file means nothing was approved yet. */
export async function readApprovals(file: string): Promise<ApprovalRecord[]> {
  let text: string;
  try {
    text = await fs.readFile(file, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as ApprovalRecord);
}

/** The report of the most recent run, kept in the output directory. */
export const LATEST_REPORT_FILE = 'latest-report.json';

/** Reads the report of a run, or of the latest run when no id is given. */
export async function loadRunReport(
  config: DiffraConfig,
  cwd: string,
  runId?: string,
): Promise<TestRunReport> {
  const outputDir = resolveOutputDir(config, cwd);
  const reportPath = runId
    ? path.join(outputDir, 'runs', runId, 'report.json')
    : path.join(outputDir, LATEST_REPORT_FILE);
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
    if (!isTestRunReport(parsed)) {
      throw new Error('Invalid test report structure.');
    }
    return parsed;
  } catch {
    throw new Error('No latest test run found. Run "diffra test" first.');
  }
}

/**
 * Promotes the candidates of a run as the baseline for the current commit.
 * Candidates are read back through the storage adapter, so this works for
 * remote stores as well as the local disk.
 */
export async function approveBaselines(
  options: {
    config?: Partial<DiffraConfig>;
    configFile?: string;
    cwd?: string;
    runId?: string;
    report?: TestRunReport;
    /** Promote only these snapshot ids. Omit to promote the whole run. */
    ids?: string[];
    /** Who approved and why, written to the approvals log. Defaults to a person. */
    provenance?: ApprovalProvenance;
  } = {},
): Promise<{ count: number; failed: number }> {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd, options.config, options.configFile);
  const gitInfo = await getGitInfo(config.runner?.baselineBranch, cwd);
  const storage = resolveStorageAdapter(config, cwd);
  if (storage.init) {
    await storage.init();
  }

  const report =
    options.report ?? (await loadRunReport(config, cwd, options.runId));

  const ids = options.ids && options.ids.length > 0 ? options.ids : undefined;
  if (ids) {
    const known = new Set(report.results.map((r) => r.id));
    const unknown = ids.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new Error(
        `No snapshot with id ${unknown.map((id) => `"${id}"`).join(', ')} in run ${report.runId}.`,
      );
    }
  }

  let approved = 0;
  let failed = 0;
  const promoted: SnapshotKey[] = [];
  const approvedResults: VisualTestResult[] = [];
  for (const result of report.results) {
    if (ids && !ids.includes(result.id)) continue;
    // Neither a failed capture nor a removed target has an image to promote.
    if (result.status === 'failed' || result.status === 'removed') continue;

    const key = {
      targetId: result.id,
      viewport: result.viewport,
      browser: result.browser,
    };
    try {
      const candidate = await storage.downloadCandidate(report.runId, key);
      if (!candidate) {
        throw new Error(`no candidate image stored for run ${report.runId}`);
      }
      await storage.uploadBaseline(gitInfo.commit, key, candidate);
      promoted.push(key);
      approvedResults.push(result);
      approved++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[diffra] Could not approve baseline for ${result.id}: ${msg}`,
      );
    }
  }

  // The list of what this commit's baseline holds lets later runs notice
  // removed targets. A shard, a filtered run or a chosen subset promotes only
  // part of it, so it must not overwrite the list for the whole commit.
  const partial = Boolean(report.shard || report.filter || ids);
  if (storage.uploadBaselineKeys && !partial && failed === 0) {
    await storage.uploadBaselineKeys(gitInfo.commit, promoted);
  }

  if (approvedResults.length > 0) {
    const record: ApprovalRecord = {
      at: new Date().toISOString(),
      actor: options.provenance?.actor ?? 'human',
      ...(options.provenance?.rationale
        ? { rationale: options.provenance.rationale }
        : {}),
      runId: report.runId,
      commit: gitInfo.commit,
      snapshots: approvedResults.map((r) => ({
        id: r.id,
        browser: r.browser,
        viewport: { width: r.viewport.width, height: r.viewport.height },
        status: r.status,
        classification: r.classification?.kind,
        proof: r.explanation?.proof?.status,
      })),
    };
    try {
      const outputDir = resolveOutputDir(config, cwd);
      await fs.mkdir(outputDir, { recursive: true });
      await fs.appendFile(
        path.join(outputDir, APPROVALS_FILE),
        `${JSON.stringify(record)}\n`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[diffra] Could not record the approval: ${msg}`);
    }
  }

  return { count: approved, failed };
}
