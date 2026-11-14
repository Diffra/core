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
  TestRunReport,
} from '../types/index.js';

const LATEST_REPORT_FILE = 'latest-report.json';

async function loadReport(
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
    options.report ?? (await loadReport(config, cwd, options.runId));

  let approved = 0;
  let failed = 0;
  const promoted: SnapshotKey[] = [];
  for (const result of report.results) {
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
  // removed targets. A shard promotes only part of it, so it must not
  // overwrite the list for the whole commit.
  if (storage.uploadBaselineKeys && !report.shard && failed === 0) {
    await storage.uploadBaselineKeys(gitInfo.commit, promoted);
  }

  return { count: approved, failed };
}
