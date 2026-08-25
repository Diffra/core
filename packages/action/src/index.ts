import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  approveBaselines,
  formatMarkdownSummary,
  runVisualRegression,
} from '@diffra/core';

const DEFAULT_SERVER_PORT = 6006;
const MAX_CONCURRENCY = 16;

export function matchesBranchOrBool(
  inputValue: string,
  currentRef: string,
  defaultBranch?: string,
): boolean {
  if (!inputValue || inputValue === 'false') return false;
  if (inputValue === 'true') return true;

  const currentBranch = currentRef.replace(/^refs\/heads\//, '');
  if (inputValue === 'default-branch') {
    return defaultBranch ? currentBranch === defaultBranch : currentBranch === 'main' || currentBranch === 'master';
  }
  return (
    currentBranch === inputValue || currentRef === `refs/heads/${inputValue}`
  );
}

export async function run(): Promise<void> {
  let staticServer: http.Server | null = null;
  const currentRef = github.context.ref || process.env.GITHUB_REF || '';

  try {
    const rawProjectToken =
      core.getInput('projectToken') ||
      core.getInput('token') ||
      process.env.GITHUB_TOKEN;
    if (rawProjectToken) {
      core.setSecret(rawProjectToken);
    }
    const token = rawProjectToken;

    const rawWorkingDir = core.getInput('workingDir') || '.';
    const workingDir = path.resolve(process.cwd(), rawWorkingDir);

    const driverInput = core.getInput('driver');
    const urlsInput = core.getInput('urls');
    const storybookBuildDir = core.getInput('storybookBuildDir');
    let storybookUrl = core.getInput('storybookUrl');
    const portInput = core.getInput('storybookPort');
    const thresholdInput =
      core.getInput('diffThreshold') || core.getInput('threshold');
    const concurrencyInput = core.getInput('concurrency');
    const exitZeroInput = core.getInput('exitZeroOnChanges') || 'true';
    const autoAcceptInput = core.getInput('autoAcceptChanges') || 'default-branch';
    const exitOnceUploadedInput = core.getInput('exitOnceUploaded');

    const defaultBranch =
      github.context.payload.repository?.default_branch;

    const shouldExitZeroOnChanges = matchesBranchOrBool(
      exitZeroInput,
      currentRef,
      defaultBranch,
    );
    const shouldAutoAccept = autoAcceptInput
      ? matchesBranchOrBool(autoAcceptInput, currentRef, defaultBranch)
      : false;
    const shouldExitOnceUploaded = matchesBranchOrBool(
      exitOnceUploadedInput,
      currentRef,
      defaultBranch,
    );

    // 1. Static Preview Server with Path Traversal Boundary Verification
    if (storybookBuildDir && !storybookUrl) {
      const port = portInput ? parseInt(portInput, 10) : DEFAULT_SERVER_PORT;
      const staticRoot = path.resolve(workingDir, storybookBuildDir);

      staticServer = http.createServer(async (req, res) => {
        try {
          const parsedUrl = new URL(req.url || '/', 'http://localhost');
          let normalizedPath = path.normalize(parsedUrl.pathname);
          if (normalizedPath === '/' || normalizedPath === '\\') {
            normalizedPath = '/index.html';
          }

          const safePath = path.resolve(staticRoot, `.${normalizedPath}`);
          if (
            !safePath.startsWith(staticRoot) &&
            !safePath.startsWith(`${staticRoot}/`)
          ) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
          }

          const content = await fs.readFile(safePath);
          const ext = path.extname(safePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.mjs': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
          };

          const contentType = mimeTypes[ext] || 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': contentType,
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(content);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        }
      });

      await new Promise<void>((resolve, reject) => {
        staticServer?.on('error', reject);
        staticServer?.listen(port, '127.0.0.1', () => resolve());
      });

      const addr = staticServer.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      storybookUrl = `http://127.0.0.1:${actualPort}`;
      core.info(`Started static preview server on ${storybookUrl}`);
    }

    core.info('Starting Diffra visual regression test run...');

    // 2. Configuration Setup
    const configOverrides: Record<string, unknown> = {};
    if (driverInput) {
      configOverrides.driver = driverInput;
    }
    if (urlsInput) {
      try {
        configOverrides.urls = urlsInput.startsWith('[')
          ? JSON.parse(urlsInput)
          : urlsInput
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
      } catch {
        configOverrides.urls = urlsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    if (storybookUrl) {
      configOverrides.storybookUrl = storybookUrl;
    }

    if (thresholdInput) {
      const parsedThreshold = parseFloat(thresholdInput);
      if (
        !Number.isNaN(parsedThreshold) &&
        parsedThreshold >= 0 &&
        parsedThreshold <= 1
      ) {
        configOverrides.diffThreshold = parsedThreshold;
        configOverrides.threshold = parsedThreshold;
      }
    }

    if (concurrencyInput) {
      const parsedConcurrency = parseInt(concurrencyInput, 10);
      if (!Number.isNaN(parsedConcurrency) && parsedConcurrency > 0) {
        configOverrides.concurrency = Math.min(parsedConcurrency, MAX_CONCURRENCY);
      }
    }

    // 3. GitHub PR Comment & Commit Status Configuration
    const repoOwner = github.context.repo.repo ? github.context.repo.owner : undefined;
    const repoName = github.context.repo.repo;
    const repoString =
      repoOwner && repoName ? `${repoOwner}/${repoName}` : process.env.GITHUB_REPOSITORY;
    const prNumber =
      github.context.payload.pull_request?.number ||
      (process.env.GITHUB_REF?.match(/^refs\/pull\/(\d+)\/(merge|head)$/)
        ? parseInt(process.env.GITHUB_REF.split('/')[2], 10)
        : undefined);

    const viewerUrlInput = core.getInput('viewerUrl');
    const autoPagesUrl =
      repoOwner && repoName
        ? `https://${repoOwner}.github.io/${repoName}`
        : undefined;
    const viewerUrl = viewerUrlInput || process.env.DIFFRA_VIEWER_URL || autoPagesUrl;

    if (viewerUrl) {
      configOverrides.viewerUrl = viewerUrl;
    }

    if (token && repoString) {
      configOverrides.notifier = {
        github: {
          token,
          repo: repoString,
          prNumber,
          viewerUrl,
        },
      };
    }

    // 4. Test Execution
    const report = await runVisualRegression({
      cwd: workingDir,
      config: configOverrides,
      onProgress: (step, current, total) => {
        core.info(`[${current}/${total}] ${step}`);
      },
    });

    const reportJsonPath = path.resolve(
      workingDir,
      '.diffra/runs',
      report.runId,
      'report.json',
    );
    const reportUrl = `file://${reportJsonPath}`;

    // 5. Standard Action Outputs
    core.setOutput('url', reportUrl);
    core.setOutput('buildUrl', reportUrl);
    core.setOutput('reportUrl', reportUrl);
    core.setOutput('storybookUrl', storybookUrl || '');
    core.setOutput('changeCount', String(report.summary.changed));
    core.setOutput('storyCount', String(report.summary.total));
    core.setOutput('targetCount', String(report.summary.total));

    core.info('\nTest Run Summary:');
    core.info(`  Total:     ${report.summary.total}`);
    core.info(`  Passed:    ${report.summary.unchanged}`);
    core.info(`  Added:     ${report.summary.added}`);
    core.info(`  Changed:   ${report.summary.changed}`);
    core.info(`  Report:    ${reportUrl}\n`);

    // 6. GitHub Actions Job Step Summary
    try {
      const summaryMarkdown = formatMarkdownSummary(
        report,
        reportUrl,
        viewerUrl,
      );
      await core.summary.addRaw(summaryMarkdown).write();
    } catch {}

    // 7. Emit GitHub Annotations / Warnings for Changed Targets
    for (const result of report.results) {
      if (result.status === 'changed') {
        const pct = result.diffResult?.diffPercentage.toFixed(2) ?? '0.00';
        const count = result.diffResult?.diffCount.toLocaleString() ?? '0';
        core.warning(
          `Visual diff detected in "${result.component} / ${result.name}" [${result.viewport.width}x${result.viewport.height}]: ${pct}% change (${count} pixels).`,
          {
            title: `Visual Change: ${result.component} - ${result.name}`,
          },
        );
      }
    }

    if (shouldExitOnceUploaded) {
      core.info('exitOnceUploaded flag matched. Exiting successfully.');
      core.setOutput('code', '0');
      core.setOutput('status', 'passed');
      return;
    }

    // 8. Auto-Accept on Merge or Target Branch
    if (shouldAutoAccept) {
      core.info(
        `Promoting candidate snapshots as the new baseline for ${currentRef}...`,
      );
      const approveResult = await approveBaselines({
        cwd: workingDir,
        report,
      });
      core.info(
        `Successfully promoted ${approveResult.count} snapshots as baseline.`,
      );
      core.setOutput('code', '0');
      core.setOutput('status', 'passed');
      return;
    }

    if (report.summary.changed > 0) {
      core.setOutput('status', 'changes_found');

      if (shouldExitZeroOnChanges) {
        core.info(
          `Visual changes detected (${report.summary.changed} changed), but exitZeroOnChanges is enabled for ${currentRef}.`,
        );
        core.setOutput('code', '0');
        return;
      }

      core.setOutput('code', '1');
      core.setFailed(
        `Diffra found ${report.summary.changed} visual regression differences.`,
      );
      return;
    }

    core.setOutput('code', '0');
    core.setOutput('status', 'passed');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setOutput('code', '1');
    core.setOutput('status', 'failed');
    core.setFailed(`Diffra action failed: ${msg}`);
  } finally {
    if (staticServer) {
      staticServer.close();
    }
  }
}

if (process.env.GITHUB_ACTIONS) {
  run();
}
