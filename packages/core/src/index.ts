import path from 'node:path';
import { createBaselineResolver } from './baselines.js';
import { ensureBrowsers } from './capture/browser-install.js';
import { runCaptures } from './capture/screenshot-runner.js';
import { loadConfig } from './config/loader.js';
import {
  DEFAULT_AGENT_CONTEXT,
  DEFAULT_CONCURRENCY,
  DEFAULT_DELAY_MS,
} from './config/schema.js';
import { resolveDrivers } from './drivers/index.js';
import {
  changedFilesSince,
  DEFAULT_BASELINE_HISTORY_DEPTH,
  getBaselineHistory,
  getGitInfo,
} from './git/baseline.js';
import {
  classifyResults,
  createIntent,
  DEFAULT_INTENT_FILE,
  type NewIntent,
  readIntents,
} from './intent/index.js';
import {
  type CompareContext,
  compareCapture,
  failedResult,
  UNGROUPED,
} from './pipeline/compare.js';
import {
  buildTasks,
  discoverTargets,
  resolveProjects,
} from './pipeline/plan.js';
import { findRemoved } from './pipeline/removed.js';
import { assembleReport, notifyAll, publishReport } from './pipeline/report.js';
import { resolveDiffEngine } from './plugins/diff/index.js';
import { resolveNotifiers } from './plugins/notifiers/index.js';
import { PluginRunner } from './plugins/runner.js';
import { resolveStorageAdapter } from './plugins/storage/index.js';
import {
  ReviewBundle,
  resolveOutputDir,
  runDirectory,
} from './report/bundle.js';
import type {
  DiffraConfig,
  TestRunReport,
  VisualTestResult,
} from './types/index.js';

/** What a report names as its filter when it covers only the targets given by `only`. */
export const AFFECTED_FILTER = 'affected';

export { type BrowserName, ensureBrowsers } from './capture/browser-install.js';
export * from './config/index.js';
export {
  DEFAULT_CONCURRENCY,
  DEFAULT_DELAY_MS,
  DEFAULT_DIFF_THRESHOLD,
  DEFAULT_VIEWPORTS,
  DiffraConfigSchema,
} from './config/schema.js';
export * from './context/ledger.js';
export * from './drivers/index.js';
export * from './git/baseline.js';
export * from './intent/index.js';
export * from './intent/parse.js';
export * from './intent/policy.js';
export * from './pipeline/affected.js';
export {
  APPROVALS_FILE,
  type ApprovalProvenance,
  type ApprovalRecord,
  type ApprovedSnapshot,
  approveBaselines,
  LATEST_REPORT_FILE,
  loadRunReport,
  readApprovals,
} from './pipeline/approve.js';
export * from './pipeline/explain.js';
export * from './pipeline/fix.js';
export * from './pipeline/prove.js';
export * from './pipeline/prove-run.js';
export * from './pipeline/verify.js';
export * from './playwright/index.js';
export * from './plugins/index.js';
export * from './plugins/notifiers/summary.js';
export * from './report/bundle.js';
export * from './report/crop.js';
export * from './report/gate.js';
export * from './report/generator.js';
export * from './report/merger.js';
export * from './server/static.js';
export * from './types/index.js';
export * from './utils/viewport.js';

/** The finished report plus where its review bundle was written. */
export interface RunResult extends TestRunReport {
  /** Directory holding index.html, report.json and the images for review */
  reviewDir: string;
}

export interface RunOptions {
  config?: Partial<DiffraConfig>;
  configFile?: string;
  cwd?: string;
  /** Overrides runner.shard, for example "1/4" */
  shard?: string;
  /** Capture only the targets with these ids, such as those a change affects */
  only?: string[];
  /** Intents declared for this run only, besides those in the intent file */
  intents?: NewIntent[];
  onProgress?: (step: string, current: number, total: number) => void;
}

/**
 * Runs the visual regression pipeline: discover targets, capture them, compare
 * each capture with its baseline as it arrives, then publish the report and
 * the review bundle and notify. Each stage lives in ./pipeline.
 */
export async function runVisualRegression(
  options: RunOptions = {},
): Promise<RunResult> {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd, options.config, options.configFile);

  const plugins = new PluginRunner(config.plugins || []);
  await plugins.hookSetup(config);

  const gitInfo = await getGitInfo(config.runner?.baselineBranch, cwd);
  const storage = resolveStorageAdapter(config, cwd);
  if (storage.init) {
    await storage.init();
  }
  const diffEngine = resolveDiffEngine(config);
  const notifiers = resolveNotifiers(config);
  const drivers = resolveDrivers(config, cwd);

  const driverContext = { config, cwd };
  const teardownDrivers = async () => {
    for (const driver of drivers) {
      try {
        await driver.teardown?.(driverContext);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[diffra] Warning: ${driver.name} teardown failed: ${msg}`,
        );
      }
    }
  };

  // A driver may start a server while it sets up or discovers targets, so
  // everything after setup runs under the teardown, or a failure anywhere
  // would leave the process waiting on it.
  try {
    for (const driver of drivers) {
      await driver.setup?.(driverContext);
    }

    const runId = `run-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const everything = await discoverTargets(drivers, driverContext, plugins);
    const only = options.only ? new Set(options.only) : undefined;
    const discovered = only
      ? {
          ...everything,
          targets: everything.targets.filter((t) => only.has(t.id)),
        }
      : everything;
    const shard = options.shard || config.runner?.shard;
    // A run of only some of the targets cannot tell what is gone or what a baseline holds.
    const filter =
      config.runner?.filter?.trim() || (only ? AFFECTED_FILTER : undefined);
    const tasks = buildTasks(discovered, config, shard);

    const needsBrowser = tasks.some(
      (t) => !t.driver?.capture && !t.driver?.captureAll,
    );
    if (config.runner?.installBrowsers && needsBrowser) {
      await ensureBrowsers(
        resolveProjects(config).map((p) => p.browser ?? 'chromium'),
      );
    }

    const bundle = new ReviewBundle(
      runDirectory(resolveOutputDir(config, cwd), runId),
    );
    const compareContext: CompareContext = {
      runId,
      cwd,
      changedFiles: await changedFilesSince(gitInfo.baselineCommit, cwd),
      config,
      storage,
      diffEngine,
      bundle,
      baselines: createBaselineResolver(
        storage,
        await getBaselineHistory(
          gitInfo.baselineCommit,
          config.runner?.baselineHistoryDepth ?? DEFAULT_BASELINE_HISTORY_DEPTH,
          cwd,
        ),
      ),
    };

    const results: VisualTestResult[] = [];
    const record = (result: VisualTestResult) => {
      results.push(result);
      options.onProgress?.(
        `${result.status === 'failed' ? 'Failed' : 'Compared'} ${result.group ?? UNGROUPED} / ${result.name} [${result.browser}]`,
        results.length,
        tasks.length,
      );
    };

    {
      // Captures are compared as they finish, so the run holds only the images
      // in flight rather than every screenshot at once.
      const outcome = await runCaptures(tasks, undefined, {
        attempts: config.runner?.captureAttempts,
        concurrency: config.runner?.concurrency ?? DEFAULT_CONCURRENCY,
        delay: config.snapshot?.delay ?? DEFAULT_DELAY_MS,
        pauseAnimationAtEnd: config.snapshot?.pauseAnimationAtEnd ?? true,
        cwd,
        ledger: config.agent?.context ?? DEFAULT_AGENT_CONTEXT,
        onBeforeCapture: (target, viewport) =>
          plugins.hookBeforeCapture(target, viewport),
        onCapture: async (capture) => {
          const buffer = await plugins.hookAfterCapture(
            capture.target,
            capture.viewport,
            capture.buffer,
          );
          record(await compareCapture(compareContext, { ...capture, buffer }));
        },
      });
      for (const failure of outcome.failures) {
        record(failedResult(failure, cwd));
      }

      // A shard or a filter sees only part of the targets, so it cannot tell
      // what is gone.
      if (!shard && !filter) {
        for (const gone of await findRemoved({
          storage,
          baselines: compareContext.baselines,
          bundle,
          results,
        })) {
          record(gone);
        }
      }
    }

    const intents = [
      ...(await readIntents(
        path.resolve(cwd, config.agent?.intentFile ?? DEFAULT_INTENT_FILE),
      )),
      ...(options.intents ?? []).map(createIntent),
    ];
    const report = assembleReport({
      runId,
      timestamp,
      git: gitInfo,
      results: classifyResults(results, intents),
      intents,
      config,
      bundle,
      shard,
      filter,
    });
    await publishReport(report, storage, bundle);
    await notifyAll(notifiers, report);
    await plugins.hookTestComplete(report);

    return { ...report, reviewDir: bundle.dir };
  } finally {
    await teardownDrivers();
  }
}
