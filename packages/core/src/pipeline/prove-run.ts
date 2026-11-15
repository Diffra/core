import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { DEFAULT_DELAY_MS, DEFAULT_DIFF_THRESHOLD } from '../config/schema.js';
import type { RenderLedger } from '../context/ledger.js';
import { resolveDrivers } from '../drivers/index.js';
import { resolveDiffEngine } from '../plugins/diff/index.js';
import { PluginRunner } from '../plugins/runner.js';
import {
  ReviewBundle,
  resolveOutputDir,
  runDirectory,
} from '../report/bundle.js';
import type { DiffraConfig, TestRunReport } from '../types/index.js';
import { LATEST_REPORT_FILE, loadRunReport } from './approve.js';
import { browserOf } from './compare.js';
import type { Explanation } from './explain.js';
import { buildTasks, discoverTargets } from './plan.js';
import { proveExplanation } from './prove.js';

export interface ProveOptions {
  cwd?: string;
  config?: Partial<DiffraConfig>;
  configFile?: string;
  /** The run to take the snapshot from. Defaults to the latest. */
  runId?: string;
  /** The snapshot, and which capture of it when it was taken more than once. */
  id: string;
  browser?: string;
  width?: number;
  height?: number;
}

/** Reads a file of a review bundle and refuses a path that leaves it. */
async function readFromBundle(dir: string, relative: string): Promise<Buffer> {
  const base = path.resolve(dir);
  const resolved = path.resolve(base, relative);
  if (!resolved.startsWith(base + path.sep)) {
    throw new Error(`File leaves the review bundle: ${relative}`);
  }
  return fs.readFile(resolved);
}

/** Every copy of a run's report, so that the proof is seen wherever it is read from. */
async function reportCopies(
  outputDir: string,
  runId: string,
): Promise<string[]> {
  const candidates = [
    path.join(runDirectory(outputDir, runId), 'report.json'),
    path.join(outputDir, LATEST_REPORT_FILE),
    path.join(outputDir, 'latest', 'report.json'),
  ];
  try {
    const branches = path.join(outputDir, 'branches');
    for (const branch of await fs.readdir(branches)) {
      candidates.push(path.join(branches, branch, 'latest', 'report.json'));
    }
  } catch {}
  return candidates;
}

async function saveExplanation(
  outputDir: string,
  report: TestRunReport,
  matches: (result: TestRunReport['results'][number]) => boolean,
  explanation: Explanation,
): Promise<void> {
  for (const file of await reportCopies(outputDir, report.runId)) {
    let copy: TestRunReport;
    try {
      copy = JSON.parse(await fs.readFile(file, 'utf-8')) as TestRunReport;
    } catch {
      continue;
    }
    if (copy.runId !== report.runId) continue;
    copy.results = copy.results.map((r) =>
      matches(r) ? { ...r, explanation } : r,
    );
    await fs.writeFile(file, JSON.stringify(copy, null, 2), 'utf-8');
  }
  // The review page carries its own copy of the report.
  const updated = {
    ...report,
    results: report.results.map((r) =>
      matches(r) ? { ...r, explanation } : r,
    ),
  };
  await new ReviewBundle(runDirectory(outputDir, report.runId)).finalize(
    updated,
  );
}

/**
 * Tests the cause of a changed snapshot of a run in the live page, and records
 * the outcome in the run's reports. The page it was captured from has to be
 * reachable again, such as a running Storybook or development server.
 */
export async function proveSnapshot(
  options: ProveOptions,
): Promise<{ id: string; explanation: Explanation }> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd, options.config, options.configFile);
  const outputDir = resolveOutputDir(config, cwd);
  const report = await loadRunReport(config, cwd, options.runId);

  const matches = (r: TestRunReport['results'][number]) =>
    r.id === options.id &&
    (options.browser === undefined || r.browser === options.browser) &&
    (options.width === undefined || r.viewport.width === options.width) &&
    (options.height === undefined || r.viewport.height === options.height);
  const found = report.results.filter(matches);
  const [result] = found;
  if (!result) {
    throw new Error(`No snapshot "${options.id}" in run ${report.runId}.`);
  }
  if (found.length > 1) {
    throw new Error(
      `"${options.id}" was captured more than once. Pass browser, width and height to pick one.`,
    );
  }
  if (result.status !== 'changed' || !result.explanation) {
    throw new Error(
      result.status === 'changed'
        ? `"${options.id}" has no explanation to test. No page context was recorded for it.`
        : `"${options.id}" is ${result.status}, and only a changed snapshot has a cause to test.`,
    );
  }
  if (!result.baseline?.url) {
    throw new Error(`"${options.id}" has no baseline image in the run.`);
  }

  const runDir = runDirectory(outputDir, report.runId);
  const baselineImage = await readFromBundle(runDir, result.baseline.url);
  let root: string | undefined;
  if (result.ledgers?.candidate) {
    const ledger = JSON.parse(
      (await readFromBundle(runDir, result.ledgers.candidate)).toString(
        'utf-8',
      ),
    ) as RenderLedger;
    root = ledger.root;
  }

  const plugins = new PluginRunner(config.plugins ?? []);
  await plugins.hookSetup(config);
  const drivers = resolveDrivers(config, cwd);
  const context = { config, cwd };
  for (const driver of drivers) await driver.setup?.(context);
  try {
    const discovered = await discoverTargets(drivers, context, plugins);
    const task = buildTasks(discovered, config).find(
      (t) =>
        t.target.id === result.id &&
        browserOf(t.project) === result.browser &&
        t.viewport.width === result.viewport.width &&
        t.viewport.height === result.viewport.height,
    );
    if (!task || task.driver?.capture || task.driver?.captureAll) {
      throw new Error(
        `"${options.id}" cannot be loaded again: it is not captured in a browser, or it no longer exists.`,
      );
    }
    const explanation = await proveExplanation({
      explanation: result.explanation,
      root,
      baselineImage,
      task,
      diffEngine: resolveDiffEngine(config),
      threshold:
        task.target.snapshot?.diffThreshold ??
        config.snapshot?.diffThreshold ??
        DEFAULT_DIFF_THRESHOLD,
      capture: {
        delay: config.snapshot?.delay ?? DEFAULT_DELAY_MS,
        pauseAnimationAtEnd: config.snapshot?.pauseAnimationAtEnd ?? true,
        cwd,
      },
    });
    await saveExplanation(outputDir, report, matches, explanation);
    return { id: result.id, explanation };
  } finally {
    for (const driver of drivers) {
      try {
        await driver.teardown?.(context);
      } catch {}
    }
  }
}
