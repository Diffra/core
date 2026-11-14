import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createBaselineResolver } from './baselines.js';
import { ensureBrowsers } from './capture/browser-install.js';
import {
  type CaptureFailure,
  type CaptureResult,
  type CaptureTask,
  runCaptures,
} from './capture/screenshot-runner.js';
import { loadConfig } from './config/loader.js';
import { resolveDrivers } from './drivers/index.js';
import {
  DEFAULT_BASELINE_HISTORY_DEPTH,
  getBaselineHistory,
  getGitInfo,
} from './git/baseline.js';
import { resolveDiffEngine } from './plugins/diff/index.js';
import { resolveNotifiers } from './plugins/notifiers/index.js';
import { PluginRunner } from './plugins/runner.js';
import { resolveStorageAdapter } from './plugins/storage/index.js';
import {
  ReviewBundle,
  resolveOutputDir,
  reviewUrl,
  runDirectory,
} from './report/bundle.js';
import {
  buildReportManifest,
  isTestRunReport,
  saveReportManifest,
} from './report/generator.js';
import type {
  DiffraConfig,
  Project,
  TestRunReport,
  Viewport,
  VisualDriver,
  VisualTarget,
  VisualTestResult,
} from './types/index.js';
import { normalizeViewport } from './utils/viewport.js';

const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

export { type BrowserName, ensureBrowsers } from './capture/browser-install.js';
export * from './config/index.js';
export * from './drivers/index.js';
export * from './git/baseline.js';
export * from './playwright/index.js';
export * from './plugins/index.js';
export * from './plugins/notifiers/summary.js';
export * from './report/bundle.js';
export * from './report/generator.js';
export * from './report/merger.js';
export * from './server/static.js';
export * from './types/index.js';
export * from './utils/viewport.js';

import {
  DEFAULT_CONCURRENCY,
  DEFAULT_DELAY_MS,
  DEFAULT_DIFF_THRESHOLD,
  DEFAULT_VIEWPORTS,
  DiffraConfigSchema,
} from './config/schema.js';

export {
  DEFAULT_CONCURRENCY,
  DEFAULT_DELAY_MS,
  DEFAULT_DIFF_THRESHOLD,
  DEFAULT_VIEWPORTS,
  DiffraConfigSchema,
};

/**
 * Finds all story files matching the configured glob patterns.
 * Kept for backward compatibility.
 */
export async function findStoryFiles(
  _patterns: string[],
  cwd = process.cwd(),
): Promise<string[]> {
  const matchedFiles: string[] = [];

  async function scan(dir: string) {
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          [
            'node_modules',
            '.git',
            'dist',
            '.diffra',
            'storybook-static',
          ].includes(entry.name)
        )
          continue;
        await scan(fullPath);
      } else if (entry.isFile()) {
        if (/\.stories\.(js|jsx|ts|tsx|mjs)$/.test(entry.name)) {
          matchedFiles.push(path.relative(cwd, fullPath));
        }
      }
    }
  }

  await scan(cwd);
  return matchedFiles;
}

/** The finished report plus where its review bundle was written. */
export interface RunResult extends TestRunReport {
  /** Directory holding index.html, report.json and the images for review */
  reviewDir: string;
}

/**
 * Core test runner executing the complete visual regression pipeline with pluggable drivers.
 */
export async function runVisualRegression(
  options: {
    config?: Partial<DiffraConfig>;
    configFile?: string;
    cwd?: string;
    shard?: string;
    onProgress?: (step: string, current: number, total: number) => void;
  } = {},
): Promise<RunResult> {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd, options.config, options.configFile);

  const pluginRunner = new PluginRunner(config.plugins || []);
  await pluginRunner.hookSetup(config);

  const baselineBranch = config.runner?.baselineBranch;
  const gitInfo = await getGitInfo(baselineBranch, cwd);
  const storage = resolveStorageAdapter(config, cwd);
  if (storage.init) {
    await storage.init();
  }

  const diffEngine = resolveDiffEngine(config);
  const notifiers = resolveNotifiers(config);
  const drivers = resolveDrivers(config, cwd);

  const driverContext = { config, cwd };
  for (const driver of drivers) {
    if (driver.setup) {
      await driver.setup(driverContext);
    }
  }

  const runId = `run-${Date.now()}`;
  const timestamp = new Date().toISOString();

  // 1. Discover Visual Targets across all configured drivers
  let allTargets: VisualTarget[] = [];
  const targetDriverMap = new Map<VisualTarget, VisualDriver>();
  const targetIdDriverMap = new Map<string, VisualDriver>();
  for (const driver of drivers) {
    if (driver.discover) {
      const discovered = await driver.discover(driverContext);
      for (const target of discovered) {
        (target as unknown as Record<string, unknown>).driver = driver;
        targetDriverMap.set(target, driver);
        targetIdDriverMap.set(target.id, driver);
      }
      allTargets.push(...discovered);
    }
  }

  allTargets = await pluginRunner.hookDiscoverTargets(allTargets);

  // 2. Build task matrix (targets x viewports / projects)
  const defaultViewports = (
    config.snapshot?.viewports || DEFAULT_VIEWPORTS
  ).map(normalizeViewport);
  const projects: Project[] =
    config.runner?.projects && config.runner.projects.length > 0
      ? config.runner.projects
      : [{ name: 'chromium', browser: 'chromium' }];

  let tasks: CaptureTask[] = [];

  for (const target of allTargets) {
    const targetDriver =
      targetDriverMap.get(target) ||
      targetIdDriverMap.get(target.id) ||
      ((target as unknown as Record<string, unknown>).driver as
        | VisualDriver
        | undefined);
    const rawViewports = target.snapshot?.viewports;
    const viewports: Viewport[] = rawViewports
      ? rawViewports.map(normalizeViewport)
      : defaultViewports;

    for (const project of projects) {
      const projectViewport = project.use?.viewport
        ? normalizeViewport(project.use.viewport)
        : undefined;

      const effectiveViewports = projectViewport
        ? [projectViewport]
        : viewports;

      for (const vp of effectiveViewports) {
        tasks.push({ target, viewport: vp, project, driver: targetDriver });
      }
    }
  }

  // Apply Sharding if specified
  const shardConfig = options.shard || config.runner?.shard;
  if (shardConfig) {
    const match = shardConfig.match(/^(\d+)\/(\d+)$/);
    if (match) {
      const shardIndex = Number(match[1]);
      const shardTotal = Number(match[2]);
      if (shardIndex >= 1 && shardTotal >= 1 && shardIndex <= shardTotal) {
        tasks = tasks.filter((_, i) => i % shardTotal === shardIndex - 1);
      }
    }
  }

  // 3. Capture Candidate Screenshots
  const needsBrowser = tasks.some(
    (t) => !t.driver?.capture && !t.driver?.captureAll,
  );
  if (config.runner?.installBrowsers && needsBrowser) {
    await ensureBrowsers(projects.map((p) => p.browser ?? 'chromium'));
  }
  let rawCaptures: CaptureResult[] = [];
  let captureFailures: CaptureFailure[] = [];
  try {
    const outcome = await runCaptures(tasks, undefined, {
      attempts: config.runner?.captureAttempts,
      concurrency: config.runner?.concurrency ?? DEFAULT_CONCURRENCY,
      delay: config.snapshot?.delay ?? DEFAULT_DELAY_MS,
      pauseAnimationAtEnd: config.snapshot?.pauseAnimationAtEnd ?? true,
      cwd,
    });
    rawCaptures = outcome.results;
    captureFailures = outcome.failures;
  } finally {
    for (const driver of drivers) {
      if (driver.teardown) {
        try {
          await driver.teardown(driverContext);
        } catch {}
      }
    }
  }

  // Apply post-capture plugin transformations
  const captures = await Promise.all(
    rawCaptures.map(async (cap) => {
      const buffer = await pluginRunner.hookAfterCapture(
        cap.target,
        cap.viewport,
        cap.buffer,
      );
      return { ...cap, buffer };
    }),
  );

  // 4. Compare with Baseline Screenshots (CAS & Fast-Path Matching)
  const testResults: VisualTestResult[] = [];
  const outputDir = resolveOutputDir(config, cwd);
  const bundle = new ReviewBundle(runDirectory(outputDir, runId));
  const baselines = createBaselineResolver(
    storage,
    await getBaselineHistory(
      gitInfo.baselineCommit,
      config.runner?.baselineHistoryDepth ?? DEFAULT_BASELINE_HISTORY_DEPTH,
      cwd,
    ),
  );

  for (const failure of captureFailures) {
    testResults.push({
      id: failure.target.id,
      name: failure.target.name,
      group: failure.target.group || 'General',
      viewport: failure.viewport,
      browser: failure.project?.browser || failure.project?.name || 'chromium',
      status: 'failed',
      candidate: {},
      error: failure.error,
      metadata: failure.target.metadata,
    });
  }

  for (const [i, capture] of captures.entries()) {
    const { target, viewport, project, buffer } = capture;
    const groupName = target.group || 'General';
    const browserName = project?.browser || project?.name || 'chromium';
    const candidateHash = crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex');

    options.onProgress?.(
      `Comparing ${groupName} / ${target.name} [${browserName}]`,
      i + 1,
      captures.length,
    );

    const snapshotKey = {
      targetId: target.id,
      viewport,
      browser: browserName,
    };

    // Save candidate
    const candidatePath = await storage.uploadCandidate(
      runId,
      snapshotKey,
      buffer,
    );

    // Fetch baseline
    const baselineBuffer = await baselines.find(snapshotKey);

    if (!baselineBuffer) {
      testResults.push({
        id: target.id,
        name: target.name,
        group: groupName,
        viewport,
        browser: browserName,
        status: 'added',
        candidate: {
          path: candidatePath,
          hash: candidateHash,
          url: await bundle.addImage(buffer),
        },
        metadata: target.metadata,
      });
      continue;
    }

    const baselineHash = crypto
      .createHash('sha256')
      .update(baselineBuffer)
      .digest('hex');

    // CAS $O(1)$ fast-path match: identical image hash -> 0 diff
    if (candidateHash === baselineHash) {
      testResults.push({
        id: target.id,
        name: target.name,
        group: groupName,
        viewport,
        browser: browserName,
        status: 'unchanged',
        diff: {
          diffCount: 0,
          diffPercentage: 0,
          isSameDimensions: true,
          width: viewport.width,
          height: viewport.height,
          boundingBoxes: [],
          hasDiff: false,
        },
        baseline: { hash: baselineHash },
        candidate: { path: candidatePath, hash: candidateHash },
        metadata: target.metadata,
      });
      continue;
    }

    // Compare with pluggable diff engine
    const diffThreshold =
      target.snapshot?.diffThreshold ??
      config.snapshot?.diffThreshold ??
      DEFAULT_DIFF_THRESHOLD;

    const diffResult = await diffEngine.compare(baselineBuffer, buffer, {
      threshold: diffThreshold,
      diffThreshold,
      generateDiffImage: true,
    });

    if (diffResult.hasDiff) {
      let diffPath: string | undefined;
      if (diffResult.diffImage) {
        diffPath = await storage.uploadDiff(
          runId,
          snapshotKey,
          diffResult.diffImage,
        );
      }

      testResults.push({
        id: target.id,
        name: target.name,
        group: groupName,
        viewport,
        browser: browserName,
        status: 'changed',
        diff: diffResult,
        baseline: {
          hash: baselineHash,
          url: await bundle.addImage(baselineBuffer),
        },
        candidate: {
          path: candidatePath,
          hash: candidateHash,
          url: await bundle.addImage(buffer),
        },
        diffImage: diffResult.diffImage
          ? {
              path: diffPath,
              url: await bundle.addImage(diffResult.diffImage),
            }
          : undefined,
        metadata: target.metadata,
      });
    } else {
      testResults.push({
        id: target.id,
        name: target.name,
        group: groupName,
        viewport,
        browser: browserName,
        status: 'unchanged',
        diff: diffResult,
        baseline: { hash: baselineHash },
        candidate: { path: candidatePath, hash: candidateHash },
        metadata: target.metadata,
      });
    }
  }

  // 5. Build Final Report
  const unchangedCount = testResults.filter(
    (r) => r.status === 'unchanged',
  ).length;
  const changedCount = testResults.filter((r) => r.status === 'changed').length;
  const addedCount = testResults.filter((r) => r.status === 'added').length;
  const removedCount = testResults.filter((r) => r.status === 'removed').length;
  const failedCount = testResults.filter((r) => r.status === 'failed').length;

  const summary = {
    total: testResults.length,
    passed: unchangedCount,
    changed: changedCount,
    added: addedCount,
    removed: removedCount,
    failed: failedCount,
    unchanged: unchangedCount,
  };

  const report: TestRunReport = {
    runId,
    timestamp,
    git: {
      branch: gitInfo.branch,
      commit: gitInfo.commit,
      baselineBranch: gitInfo.baselineBranch,
      baselineCommit: gitInfo.baselineCommit,
      repositoryUrl: gitInfo.repositoryUrl,
    },
    summary,
    results: testResults,
    links: config.reportBaseUrl
      ? {
          review: reviewUrl({
            reportBaseUrl: config.reportBaseUrl,
            runId,
            bundleDir: bundle.dir,
          }),
        }
      : undefined,
  };

  const reportJsonPath = await storage.saveReport(report);
  // Adapters for remote stores return a URL, which is not a place the local
  // report manifest can be written next to.
  if (!URL_SCHEME_PATTERN.test(reportJsonPath)) {
    await saveReportManifest(report, reportJsonPath);
  }
  await bundle.finalize(buildReportManifest(report));

  // 6. Run Notifiers & Plugin Completion Hooks
  for (const notifier of notifiers) {
    try {
      await notifier.notify(report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[diffra] Warning: Notifier ${notifier.name} failed: ${msg}`,
      );
    }
  }

  await pluginRunner.hookTestComplete(report);

  return { ...report, reviewDir: bundle.dir };
}

/**
 * Promotes current candidate screenshots as the new baseline for the current branch/commit.
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
  const baselineBranch = config.runner?.baselineBranch;
  const gitInfo = await getGitInfo(baselineBranch, cwd);
  const storage = resolveStorageAdapter(config, cwd);
  if (storage.init) {
    await storage.init();
  }

  let report = options.report;
  if (!report) {
    const outputDir = resolveOutputDir(config, cwd);
    const reportPath = options.runId
      ? path.join(outputDir, 'runs', options.runId, 'report.json')
      : path.join(outputDir, 'latest-report.json');

    try {
      let content: string;
      try {
        content = await fs.readFile(reportPath, 'utf-8');
      } catch {
        // Fallback to standard .diffra directory if outputDir differed from baseline dir
        const fallbackPath = options.runId
          ? path.join(cwd, '.diffra', 'runs', options.runId, 'report.json')
          : path.join(cwd, '.diffra', 'latest-report.json');
        content = await fs.readFile(fallbackPath, 'utf-8');
      }
      const parsed: unknown = JSON.parse(content);
      if (!isTestRunReport(parsed)) {
        throw new Error('Invalid test report structure.');
      }
      report = parsed;
    } catch {
      throw new Error('No latest test run found. Run "diffra test" first.');
    }
  }

  let approvedCount = 0;
  let failedCount = 0;
  for (const res of report.results) {
    // A failed capture produced no image, so there is nothing to promote.
    if (res.status === 'failed') continue;

    const key = {
      targetId: res.id,
      viewport: res.viewport,
      browser: res.browser,
    };
    try {
      const candidate = await storage.downloadCandidate(report.runId, key);
      if (!candidate) {
        throw new Error(`no candidate image stored for run ${report.runId}`);
      }
      await storage.uploadBaseline(gitInfo.commit, key, candidate);
      approvedCount++;
    } catch (err) {
      failedCount++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[diffra] Could not approve baseline for ${res.id}: ${msg}`);
    }
  }

  return { count: approvedCount, failed: failedCount };
}
