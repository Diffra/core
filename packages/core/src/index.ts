import { createBaselineResolver } from './baselines.js';
import { ensureBrowsers } from './capture/browser-install.js';
import { runCaptures } from './capture/screenshot-runner.js';
import { loadConfig } from './config/loader.js';
import { DEFAULT_CONCURRENCY, DEFAULT_DELAY_MS } from './config/schema.js';
import { resolveDrivers } from './drivers/index.js';
import {
  DEFAULT_BASELINE_HISTORY_DEPTH,
  getBaselineHistory,
  getGitInfo,
} from './git/baseline.js';
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

export { type BrowserName, ensureBrowsers } from './capture/browser-install.js';
export * from './config/index.js';
export {
  DEFAULT_CONCURRENCY,
  DEFAULT_DELAY_MS,
  DEFAULT_DIFF_THRESHOLD,
  DEFAULT_VIEWPORTS,
  DiffraConfigSchema,
} from './config/schema.js';
export * from './drivers/index.js';
export * from './git/baseline.js';
export { approveBaselines } from './pipeline/approve.js';
export * from './playwright/index.js';
export * from './plugins/index.js';
export * from './plugins/notifiers/summary.js';
export * from './report/bundle.js';
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
  for (const driver of drivers) {
    await driver.setup?.(driverContext);
  }

  const runId = `run-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const discovered = await discoverTargets(drivers, driverContext, plugins);
  const tasks = buildTasks(discovered, config, options.shard);

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

  try {
    // Captures are compared as they finish, so the run holds only the images
    // in flight rather than every screenshot at once.
    const outcome = await runCaptures(tasks, undefined, {
      attempts: config.runner?.captureAttempts,
      concurrency: config.runner?.concurrency ?? DEFAULT_CONCURRENCY,
      delay: config.snapshot?.delay ?? DEFAULT_DELAY_MS,
      pauseAnimationAtEnd: config.snapshot?.pauseAnimationAtEnd ?? true,
      cwd,
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
      record(failedResult(failure));
    }
  } finally {
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
  }

  const report = assembleReport({
    runId,
    timestamp,
    git: gitInfo,
    results,
    config,
    bundle,
  });
  await publishReport(report, storage, bundle);
  await notifyAll(notifiers, report);
  await plugins.hookTestComplete(report);

  return { ...report, reviewDir: bundle.dir };
}
