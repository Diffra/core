import fs from 'node:fs/promises';
import path from 'node:path';
import type { TestRunReport } from '../types/index.js';

export const DEFAULT_VIEWER_URL =
  process.env.DIFFRA_VIEWER_URL || 'https://viewer.diffra.dev';

/**
 * Builds the interactive viewer URL for a given report JSON endpoint.
 */
export function buildViewerUrl(
  reportJsonUrl: string,
  viewerBaseUrl = DEFAULT_VIEWER_URL,
): string {
  const cleanViewer = (viewerBaseUrl || DEFAULT_VIEWER_URL).replace(/\/$/, '');
  return `${cleanViewer}/?report=${encodeURIComponent(reportJsonUrl)}`;
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

  const safeBranch = (report.branch || 'main').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeBaselineBranch = (report.baselineBranch || 'main').replace(
    /[^a-zA-Z0-9_-]/g,
    '_',
  );

  const baselineReportUrl =
    report.baselineReportUrl ||
    `../../branches/${safeBaselineBranch}/latest/report.json`;
  const branchLatestUrl =
    report.branchLatestUrl || `../../branches/${safeBranch}/latest/report.json`;

  const manifest: TestRunReport = {
    ...report,
    baselineReportUrl,
    branchLatestUrl,
  };

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
