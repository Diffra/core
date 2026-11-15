import fs from 'node:fs/promises';
import path from 'node:path';
import type { TestRunReport } from '../types/index.js';

/**
 * Version of the report.json shape. Raised whenever a field is removed or
 * changes meaning, so tools that read reports can tell what they are reading.
 */
export const REPORT_SCHEMA_VERSION = 1;

/**
 * Runtime type guard verifying if an unknown data object matches the TestRunReport shape.
 */
export function isTestRunReport(data: unknown): data is TestRunReport {
  if (typeof data !== 'object' || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.runId === 'string' &&
    typeof candidate.timestamp === 'string' &&
    typeof candidate.summary === 'object' &&
    candidate.summary !== null &&
    Array.isArray(candidate.results)
  );
}

function sanitizeBranch(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Adds the navigation links between a run's report, its baseline's report and
 * the latest report of its branch.
 */
export function buildReportManifest(report: TestRunReport): TestRunReport {
  const safeBranch = sanitizeBranch(report.git?.branch || 'main');
  const safeBaselineBranch = sanitizeBranch(
    report.git?.baselineBranch || 'main',
  );
  return {
    ...report,
    links: {
      ...report.links,
      baselineReport:
        report.links?.baselineReport ||
        `../../branches/${safeBaselineBranch}/latest/report.json`,
      branchLatest:
        report.links?.branchLatest ||
        `../../branches/${safeBranch}/latest/report.json`,
    },
  };
}

/**
 * Saves the structured test run report JSON without inlining binary images.
 */
export async function saveReportManifest(
  report: TestRunReport,
  outputReportJsonPath: string,
): Promise<string> {
  const dir = path.dirname(outputReportJsonPath);
  await fs.mkdir(dir, { recursive: true });

  const safeBranch = sanitizeBranch(report.git?.branch || 'main');
  const manifest = buildReportManifest(report);

  await fs.writeFile(
    outputReportJsonPath,
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );

  // Maintain deterministic branches/<branch>/latest and latest/ directories
  try {
    const parentRunsDir = path.dirname(dir);
    if (path.basename(parentRunsDir) === 'runs') {
      const outputRootDir = path.dirname(parentRunsDir);

      // 1. Update branches/<branch>/latest
      const branchLatestDir = path.join(
        outputRootDir,
        'branches',
        safeBranch,
        'latest',
      );
      await fs.mkdir(branchLatestDir, { recursive: true });
      await fs.writeFile(
        path.join(branchLatestDir, 'report.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8',
      );

      // 2. Update global latest
      const globalLatestDir = path.join(outputRootDir, 'latest');
      await fs.mkdir(globalLatestDir, { recursive: true });
      await fs.writeFile(
        path.join(globalLatestDir, 'report.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8',
      );
    }
  } catch {}

  return outputReportJsonPath;
}
