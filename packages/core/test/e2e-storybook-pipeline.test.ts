import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { approveBaselines, runVisualRegression } from '../src/index.js';

describe('Real End-to-End Visual Regression Pipeline on Real Storybook 8', () => {
  let server: http.Server;
  const PORT = 6006;
  const storybookPackageDir = path.resolve(
    import.meta.dirname,
    '../../demo-storybook',
  );
  const staticDir = path.resolve(storybookPackageDir, 'storybook-static');

  beforeAll(async () => {
    // Serve real static Storybook build
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      let reqPath = url.pathname;
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

      const filePath = path.join(staticDir, reqPath);
      try {
        const content = await fs.readFile(filePath);
        const ext = path.extname(filePath);
        const contentType =
          ext === '.html'
            ? 'text/html'
            : ext === '.js'
              ? 'application/javascript'
              : ext === '.css'
                ? 'text/css'
                : ext === '.json'
                  ? 'application/json'
                  : 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
        res.end(content);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Not found: ${msg}`);
      }
    });

    await new Promise<void>((resolve) =>
      server.listen(PORT, '127.0.0.1', () => resolve()),
    );
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(path.resolve(storybookPackageDir, '.diffra'), {
      recursive: true,
      force: true,
    });
  });

  beforeEach(async () => {
    await fs.rm(path.resolve(storybookPackageDir, '.diffra'), {
      recursive: true,
      force: true,
    });
  });

  it('captures real Storybook 8 components, generates visual report, and approves baselines', async () => {
    const report = await runVisualRegression({
      cwd: storybookPackageDir,
      config: {
        storybookUrl: `http://127.0.0.1:${PORT}`,
        concurrency: 2,
        delay: 150,
      },
    });

    expect(report.runId).toBeDefined();
    expect(report.summary.total).toBeGreaterThanOrEqual(4);
    expect(report.summary.added).toBe(report.summary.total);

    for (const res of report.results) {
      expect(res.candidatePath).toBeDefined();
      if (res.candidatePath) {
        const exists = await fs
          .stat(res.candidatePath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    }

    const reportJsonPath = path.resolve(
      storybookPackageDir,
      '.diffra/runs',
      report.runId,
      'report.json',
    );
    const reportExists = await fs
      .stat(reportJsonPath)
      .then(() => true)
      .catch(() => false);
    expect(reportExists).toBe(true);

    const approveResult = await approveBaselines({ cwd: storybookPackageDir });
    expect(approveResult.count).toBe(report.summary.total);

    const secondReport = await runVisualRegression({
      cwd: storybookPackageDir,
      config: {
        storybookUrl: `http://127.0.0.1:${PORT}`,
        concurrency: 2,
        delay: 150,
      },
    });

    expect(secondReport.summary.unchanged).toBe(secondReport.summary.total);
    expect(secondReport.summary.changed).toBe(0);
    expect(secondReport.summary.added).toBe(0);
  }, 45000);
});
