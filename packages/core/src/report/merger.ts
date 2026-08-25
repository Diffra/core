import fs from 'node:fs/promises';
import path from 'node:path';
import type { TestRunReport, VisualTestResult } from '../types/index.js';

/**
 * Merges multiple partial shard report JSON files into a single cohesive TestRunReport.
 */
export async function mergeReports(
  reportInputs: Array<string | TestRunReport>,
  options: { outputDir?: string } = {},
): Promise<TestRunReport> {
  const reports: TestRunReport[] = [];

  for (const input of reportInputs) {
    if (typeof input === 'string') {
      try {
        const stats = await fs.stat(input);
        if (stats.isDirectory()) {
          const reportPath = path.join(input, 'report.json');
          const content = await fs.readFile(reportPath, 'utf-8');
          reports.push(JSON.parse(content) as TestRunReport);
        } else {
          const content = await fs.readFile(input, 'utf-8');
          reports.push(JSON.parse(content) as TestRunReport);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[diffra] Warning: Could not read shard report at ${input}: ${msg}`);
      }
    } else if (input && typeof input === 'object') {
      reports.push(input);
    }
  }

  if (reports.length === 0) {
    throw new Error('No valid shard reports found to merge.');
  }

  const primary = reports[0];
  const allResults: VisualTestResult[] = [];
  const seenIds = new Set<string>();

  for (const rep of reports) {
    for (const res of rep.results || []) {
      const key = `${res.id}--${res.browser || 'default'}--${res.viewport.width}x${res.viewport.height}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        allResults.push(res);
      }
    }
  }

  const summary = {
    total: allResults.length,
    changed: allResults.filter((r) => r.status === 'changed').length,
    added: allResults.filter((r) => r.status === 'added').length,
    removed: allResults.filter((r) => r.status === 'removed').length,
    unchanged: allResults.filter((r) => r.status === 'unchanged').length,
  };

  const mergedReport: TestRunReport = {
    runId: primary.runId,
    timestamp: primary.timestamp,
    branch: primary.branch,
    commit: primary.commit,
    baselineCommit: primary.baselineCommit,
    baselineBranch: primary.baselineBranch,
    repositoryUrl: primary.repositoryUrl,
    viewerUrl: primary.viewerUrl,
    summary,
    results: allResults,
  };

  if (options.outputDir) {
    const outDir = path.resolve(process.cwd(), options.outputDir);
    await fs.mkdir(outDir, { recursive: true });
    const reportPath = path.join(outDir, 'report.json');
    await fs.writeFile(reportPath, JSON.stringify(mergedReport, null, 2), 'utf-8');

    const latestPath = path.join(outDir, 'latest-report.json');
    await fs.writeFile(latestPath, JSON.stringify(mergedReport, null, 2), 'utf-8');
  }

  return mergedReport;
}
