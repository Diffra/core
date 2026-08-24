import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import type { TestRunReport } from '../types/index.js';

/**
 * Embeds test report data into an interactive single-file static HTML report.
 */
export async function generateHtmlReport(
  report: TestRunReport,
  outputHtmlPath: string,
): Promise<string> {
  const dir = path.dirname(outputHtmlPath);
  await fs.mkdir(dir, { recursive: true });

  const enrichedResults = await Promise.all(
    report.results.map(async (res) => {
      let baselineUrl = res.baselineUrl;
      let candidateUrl = res.candidateUrl;
      let diffUrl = res.diffUrl;

      if (!baselineUrl && res.baselinePath) {
        try {
          const buf = await fs.readFile(res.baselinePath);
          baselineUrl = `data:image/png;base64,${buf.toString('base64')}`;
        } catch {}
      }
      if (!candidateUrl && res.candidatePath) {
        try {
          const buf = await fs.readFile(res.candidatePath);
          candidateUrl = `data:image/png;base64,${buf.toString('base64')}`;
        } catch {}
      }
      if (!diffUrl && res.diffPath) {
        try {
          const buf = await fs.readFile(res.diffPath);
          diffUrl = `data:image/png;base64,${buf.toString('base64')}`;
        } catch {}
      }

      return {
        id: res.id,
        name: res.name,
        component: res.component,
        status: res.status,
        diffPercentage: res.diffResult?.diffPercentage || 0,
        diffCount: res.diffResult?.diffCount || 0,
        viewport: res.viewport,
        baselineUrl,
        candidateUrl,
        diffUrl,
        boundingBoxes: res.diffResult?.boundingBoxes || [],
      };
    }),
  );

  const safeBranch = (report.branch || 'main').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeBaselineBranch = (report.baselineBranch || 'main').replace(
    /[^a-zA-Z0-9_-]/g,
    '_',
  );

  const baselineReportUrl =
    report.baselineReportUrl ||
    `../../branches/${safeBaselineBranch}/latest/index.html`;
  const branchLatestUrl =
    report.branchLatestUrl || `../../branches/${safeBranch}/latest/index.html`;

  const manifest = {
    runId: report.runId,
    timestamp: report.timestamp,
    branch: report.branch,
    commit: report.commit,
    baselineCommit: report.baselineCommit,
    baselineBranch: report.baselineBranch || 'main',
    repositoryUrl: report.repositoryUrl,
    baselineReportUrl,
    branchLatestUrl,
    summary: report.summary,
    results: enrichedResults,
  };

  // Find and read the standalone viewer bundle and stylesheet
  let viewerJs = '';
  let viewerCss = '';
  const candidatePaths = [
    typeof import.meta !== 'undefined' && import.meta.dirname
      ? path.resolve(
          import.meta.dirname,
          '../../../viewer/dist/viewer.bundle.js',
        )
      : '',
    typeof import.meta !== 'undefined' && import.meta.dirname
      ? path.resolve(
          import.meta.dirname,
          '../../../../packages/viewer/dist/viewer.bundle.js',
        )
      : '',
    typeof __dirname !== 'undefined'
      ? path.resolve(__dirname, '../../../viewer/dist/viewer.bundle.js')
      : '',
    typeof __dirname !== 'undefined'
      ? path.resolve(
          __dirname,
          '../../../../packages/viewer/dist/viewer.bundle.js',
        )
      : '',
    path.resolve(process.cwd(), 'packages/viewer/dist/viewer.bundle.js'),
    path.resolve(
      process.cwd(),
      'node_modules/@diffra/viewer/dist/viewer.bundle.js',
    ),
  ].filter(Boolean);

  for (const p of candidatePaths) {
    try {
      viewerJs = await fs.readFile(p, 'utf-8');
      if (viewerJs) {
        const cssPath = p.replace(/\.bundle\.js$/, '.css');
        try {
          viewerCss = await fs.readFile(cssPath, 'utf-8');
        } catch {}
        break;
      }
    } catch {}
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Diffra Visual Regression Report - ${report.runId}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
${viewerCss}
  </style>
</head>
<body>
  <div id="root"></div>

  <script id="diffra-data" type="application/json">
${JSON.stringify(manifest, null, 2)}
  </script>

  <script>
${viewerJs}
  </script>
</body>
</html>`;

  await fs.writeFile(outputHtmlPath, html, 'utf-8');

  // Also maintain deterministic branches/<branch>/latest and latest/ directories
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
        path.join(branchLatestDir, 'index.html'),
        html,
        'utf-8',
      );
      await fs.writeFile(
        path.join(branchLatestDir, 'report.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8',
      );

      // 2. Update global latest
      const globalLatestDir = path.join(outputRootDir, 'latest');
      await fs.mkdir(globalLatestDir, { recursive: true });
      await fs.writeFile(
        path.join(globalLatestDir, 'index.html'),
        html,
        'utf-8',
      );
      await fs.writeFile(
        path.join(globalLatestDir, 'report.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8',
      );
    }
  } catch {}

  return outputHtmlPath;
}

/**
 * Starts a lightweight local HTTP server to preview the HTML report.
 */
export async function serveReport(
  reportHtmlPath: string,
  port = 9000,
): Promise<{ server: http.Server; url: string }> {
  const content = await fs.readFile(reportHtmlPath, 'utf-8');

  const server = http.createServer((_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({
        server,
        url: `http://localhost:${port}`,
      });
    });
  });
}
