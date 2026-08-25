import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type CaptureResult,
  type CaptureTask,
  captureTargets,
} from './capture/screenshot-runner.js';
import { loadConfig } from './config/loader.js';
import { resolveDrivers } from './drivers/index.js';
import { getGitInfo } from './git/baseline.js';
import { normalizeViewport } from './utils/viewport.js';
import { resolveDiffEngine } from './plugins/diff/index.js';
import { resolveNotifiers } from './plugins/notifiers/index.js';
import { PluginRunner } from './plugins/runner.js';
import { resolveStorageAdapter } from './plugins/storage/index.js';
import { buildViewerUrl, saveReportManifest } from './report/generator.js';
import type {
  DiffraConfig,
  Project,
  TestRunReport,
  Viewport,
  VisualTarget,
  VisualTestResult,
} from './types/index.js';

export * from './config/index.js';
export * from './drivers/index.js';
export * from './git/baseline.js';
export * from './plugins/notifiers/summary.js';
export * from './utils/viewport.js';
export * from './plugins/index.js';
export * from './playwright/index.js';
export * from './report/generator.js';
export * from './report/merger.js';
export * from './types/index.js';

import {
  DEFAULT_DIFF_THRESHOLD,
  DEFAULT_VIEWPORTS,
} from './config/schema.js';

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

/**
 * Core test runner executing the complete visual regression pipeline with pluggable drivers.
 */
export async function runVisualRegression(
  options: {
    config?: Partial<DiffraConfig>;
    cwd?: string;
    shard?: string;
    onProgress?: (step: string, current: number, total: number) => void;
  } = {},
): Promise<TestRunReport> {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd, options.config);

  const pluginRunner = new PluginRunner(config.plugins || []);
  await pluginRunner.hookSetup(config);

  const gitInfo = await getGitInfo(config.baselineBranch, cwd);
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
  for (const driver of drivers) {
    if (driver.discover) {
      const discovered = await driver.discover(driverContext);
      allTargets.push(...discovered);
    }
  }

  allTargets = await pluginRunner.hookDiscoverTargets(allTargets);

  // 2. Build task matrix (targets x viewports / projects)
  const defaultViewports = (
    config.viewports || DEFAULT_VIEWPORTS
  ).map(normalizeViewport);
  const projects: Project[] =
    config.projects && config.projects.length > 0
      ? config.projects
      : [{ name: 'chromium', browser: 'chromium' }];

  let tasks: CaptureTask[] = [];

  for (const target of allTargets) {
    const rawViewports =
      target.parameters?.snapshot?.viewports ||
      target.parameters?.visual?.viewports ||
      target.parameters?.diffra?.viewports;
    const viewports: Viewport[] = rawViewports
      ? rawViewports.map(normalizeViewport)
      : defaultViewports;

    for (const project of projects) {
      const projectViewport = project.use?.viewport
        ? normalizeViewport(project.use.viewport)
        : undefined;

      const effectiveViewports = projectViewport ? [projectViewport] : viewports;

      for (const vp of effectiveViewports) {
        tasks.push({ target, viewport: vp, project });
      }
    }
  }

  // Apply Sharding if specified
  const shardConfig = options.shard || config.shard;
  if (shardConfig) {
    const match = shardConfig.match(/^(\d+)\/(\d+)$/);
    if (match) {
      const shardIndex = parseInt(match[1], 10);
      const shardTotal = parseInt(match[2], 10);
      if (shardIndex >= 1 && shardTotal >= 1 && shardIndex <= shardTotal) {
        tasks = tasks.filter((_, i) => i % shardTotal === (shardIndex - 1));
      }
    }
  }

  // 3. Capture Candidate Screenshots
  const activeBaseUrl =
    config.baseUrl || config.previewUrl || config.storybookUrl;
  let rawCaptures: CaptureResult[] = [];
  try {
    rawCaptures = await captureTargets(tasks, activeBaseUrl, {
      concurrency: config.concurrency,
      delay: config.delay,
      pauseAnimationAtEnd: config.pauseAnimationAtEnd ?? true,
      cwd,
    });
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

  for (let i = 0; i < captures.length; i++) {
    const { target, viewport, project, buffer } = captures[i];
    const groupName = target.group || target.component || 'General';
    const browserName = project?.browser || project?.name || 'chromium';
    const candidateHash = crypto.createHash('sha256').update(buffer).digest('hex');

    options.onProgress?.(
      `Comparing ${groupName} / ${target.name} [${browserName}]`,
      i + 1,
      captures.length,
    );

    // Save candidate
    const candidatePath = await storage.uploadCandidate(
      runId,
      target.id,
      viewport,
      buffer,
      { browser: browserName },
    );

    // Fetch baseline
    const baselineBuffer = await storage.downloadBaseline(
      gitInfo.baselineCommit,
      target.id,
      viewport,
      { browser: browserName },
    );

    if (!baselineBuffer) {
      testResults.push({
        id: target.id,
        name: target.name,
        group: groupName,
        component: groupName,
        viewport,
        browser: browserName,
        blobHash: candidateHash,
        status: 'added',
        candidatePath,
        metadata: target.metadata,
      });
      continue;
    }

    const baselineHash = crypto.createHash('sha256').update(baselineBuffer).digest('hex');

    // CAS $O(1)$ fast-path match: identical image hash -> 0 diff
    if (candidateHash === baselineHash) {
      testResults.push({
        id: target.id,
        name: target.name,
        group: groupName,
        component: groupName,
        viewport,
        browser: browserName,
        blobHash: candidateHash,
        baselineBlobHash: baselineHash,
        status: 'unchanged',
        diffResult: {
          diffCount: 0,
          diffPercentage: 0,
          isSameDimensions: true,
          width: viewport.width,
          height: viewport.height,
          boundingBoxes: [],
          hasDiff: false,
        },
        candidatePath,
        metadata: target.metadata,
      });
      continue;
    }

    // Compare with pluggable diff engine using parameters.snapshot diffThreshold
    const diffThreshold =
      target.parameters?.snapshot?.diffThreshold ??
      target.parameters?.snapshot?.threshold ??
      target.parameters?.visual?.threshold ??
      target.parameters?.diffra?.threshold ??
      config.diffThreshold ??
      config.threshold ??
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
          target.id,
          viewport,
          diffResult.diffImage,
          { browser: browserName },
        );
      }

      testResults.push({
        id: target.id,
        name: target.name,
        group: groupName,
        component: groupName,
        viewport,
        browser: browserName,
        blobHash: candidateHash,
        baselineBlobHash: baselineHash,
        status: 'changed',
        diffResult,
        candidatePath,
        diffPath,
        metadata: target.metadata,
      });
    } else {
      testResults.push({
        id: target.id,
        name: target.name,
        group: groupName,
        component: groupName,
        viewport,
        browser: browserName,
        blobHash: candidateHash,
        baselineBlobHash: baselineHash,
        status: 'unchanged',
        diffResult,
        candidatePath,
        metadata: target.metadata,
      });
    }
  }

  // 5. Build Final Report
  const summary = {
    total: testResults.length,
    changed: testResults.filter((r) => r.status === 'changed').length,
    added: testResults.filter((r) => r.status === 'added').length,
    removed: testResults.filter((r) => r.status === 'removed').length,
    unchanged: testResults.filter((r) => r.status === 'unchanged').length,
  };

  const report: TestRunReport = {
    runId,
    timestamp,
    branch: gitInfo.branch,
    commit: gitInfo.commit,
    baselineCommit: gitInfo.baselineCommit,
    baselineBranch: config.baselineBranch || 'main',
    repositoryUrl: gitInfo.repositoryUrl,
    viewerUrl: config.viewerUrl,
    summary,
    results: testResults,
  };

  const reportJsonPath = await storage.saveReport(report);
  await saveReportManifest(report, reportJsonPath);

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

  return report;
}

/**
 * Promotes current candidate screenshots as the new baseline for the current branch/commit.
 */
export async function approveBaselines(
  options: {
    config?: Partial<DiffraConfig>;
    cwd?: string;
    runId?: string;
    report?: TestRunReport;
  } = {},
): Promise<{ count: number }> {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd, options.config);
  const gitInfo = await getGitInfo(config.baselineBranch, cwd);
  const storage = resolveStorageAdapter(config, cwd);
  if (storage.init) {
    await storage.init();
  }

  let report = options.report;
  if (!report) {
    const outputDir = path.resolve(cwd, config.outputDir || '.diffra');
    const reportPath = options.runId
      ? path.join(outputDir, 'runs', options.runId, 'report.json')
      : path.join(outputDir, 'latest-report.json');

    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      report = JSON.parse(content) as TestRunReport;
    } catch {
      throw new Error('No latest test run found. Run "diffra test" first.');
    }
  }

  let approvedCount = 0;
  for (const res of report.results) {
    if (res.candidatePath) {
      try {
        const candidateBuf = await fs.readFile(res.candidatePath);
        await storage.uploadBaseline(
          gitInfo.commit,
          res.id,
          res.viewport,
          candidateBuf,
          { browser: res.browser },
        );
        approvedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[diffra] Could not approve baseline for ${res.id}: ${msg}`,
        );
      }
    }
  }

  return { count: approvedCount };
}
