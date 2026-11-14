import type { GitInfo } from '../git/baseline.js';
import type { ReviewBundle } from '../report/bundle.js';
import { reviewUrl } from '../report/bundle.js';
import {
  buildReportManifest,
  saveReportManifest,
} from '../report/generator.js';
import type {
  DiffraConfig,
  NotifierAdapter,
  StorageAdapter,
  TestRunReport,
  TestRunSummary,
  VisualTestResult,
} from '../types/index.js';

/** Adapters for remote stores return a URL, which is not a local path. */
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

export function summarize(results: VisualTestResult[]): TestRunSummary {
  const count = (status: VisualTestResult['status']) =>
    results.filter((r) => r.status === status).length;
  return {
    total: results.length,
    passed: count('unchanged'),
    changed: count('changed'),
    added: count('added'),
    removed: count('removed'),
    failed: count('failed'),
    unchanged: count('unchanged'),
  };
}

/** Orders results the same way on every run, whatever order they finished in. */
export function sortResults(results: VisualTestResult[]): VisualTestResult[] {
  const key = (r: VisualTestResult) =>
    [r.group ?? '', r.name, r.id, r.browser ?? '', r.viewport.width].join(
      '\u0000',
    );
  return [...results].sort((a, b) => key(a).localeCompare(key(b)));
}

export function assembleReport(input: {
  runId: string;
  timestamp: string;
  git: GitInfo;
  results: VisualTestResult[];
  config: DiffraConfig;
  bundle: ReviewBundle;
  shard?: string;
}): TestRunReport {
  const { runId, timestamp, git, config, bundle, shard } = input;
  const results = sortResults(input.results);
  return {
    runId,
    timestamp,
    shard: shard || undefined,
    git: {
      branch: git.branch,
      commit: git.commit,
      baselineBranch: git.baselineBranch,
      baselineCommit: git.baselineCommit,
      repositoryUrl: git.repositoryUrl,
    },
    summary: summarize(results),
    results,
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
}

/** Records the report in storage and writes the review bundle. */
export async function publishReport(
  report: TestRunReport,
  storage: StorageAdapter,
  bundle: ReviewBundle,
): Promise<void> {
  const reportLocation = await storage.saveReport(report);
  if (!URL_SCHEME_PATTERN.test(reportLocation)) {
    await saveReportManifest(report, reportLocation);
  }
  await bundle.finalize(buildReportManifest(report));
}

/** A notifier that fails must not fail the run it is reporting on. */
export async function notifyAll(
  notifiers: NotifierAdapter[],
  report: TestRunReport,
): Promise<void> {
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
}
