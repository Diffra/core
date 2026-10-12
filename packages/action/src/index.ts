import path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  approveBaselines,
  formatMarkdownSummary,
  runVisualRegression,
} from '@diffra/core';
import { matchesBranchOrBool } from './branch.js';
import {
  createPreviewHandler,
  formatServerUrl,
  startPreviewServer,
  stopPreviewServer,
} from './preview-server.js';

export {
  createPreviewHandler,
  formatServerUrl,
  matchesBranchOrBool,
  startPreviewServer,
  stopPreviewServer,
};

const MAX_CONCURRENCY = 16;

export async function run(): Promise<void> {
  let staticServer: import('node:http').Server | null = null;
  const currentRef = github.context.ref || process.env.GITHUB_REF || '';

  try {
    // 1. Independent secret extraction and masking
    const projectToken = core.getInput('projectToken');
    if (projectToken) {
      core.setSecret(projectToken);
    }

    const token = core.getInput('token') || process.env.GITHUB_TOKEN;
    if (token) {
      core.setSecret(token);
    }

    const sensitiveEnvKeys = [
      'AWS_SECRET_ACCESS_KEY',
      'AWS_SESSION_TOKEN',
      'AZURE_STORAGE_CONNECTION_STRING',
      'AZURE_STORAGE_KEY',
      'SLACK_WEBHOOK_URL',
      'FIGMA_ACCESS_TOKEN',
    ];
    for (const key of sensitiveEnvKeys) {
      const val = process.env[key];
      if (val) {
        core.setSecret(val);
      }
    }

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
    const autoAcceptInput =
      core.getInput('autoAcceptChanges') || 'default-branch';
    const exitOnceUploadedInput = core.getInput('exitOnceUploaded');

    const defaultBranch = github.context.payload.repository?.default_branch;

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

    // 2. Static Preview Server on dynamic port 0 with boundary verification
    if (storybookBuildDir && !storybookUrl) {
      const targetPort = portInput ? parseInt(portInput, 10) : 0;
      const staticRoot = path.resolve(workingDir, storybookBuildDir);

      const preview = await startPreviewServer({
        root: staticRoot,
        port: targetPort,
      });
      staticServer = preview.server;
      storybookUrl = preview.url;
      core.info(`Started static preview server on ${storybookUrl}`);
    }

    core.info('Starting Diffra visual regression test run...');

    // 3. Configuration Setup
    const snapshotOverrides: Record<string, unknown> = {};
    const runnerOverrides: Record<string, unknown> = {};

    if (thresholdInput) {
      const parsedThreshold = parseFloat(thresholdInput);
      if (
        !Number.isNaN(parsedThreshold) &&
        parsedThreshold >= 0 &&
        parsedThreshold <= 1
      ) {
        snapshotOverrides.diffThreshold = parsedThreshold;
      }
    }

    if (concurrencyInput) {
      const parsedConcurrency = parseInt(concurrencyInput, 10);
      if (!Number.isNaN(parsedConcurrency) && parsedConcurrency > 0) {
        runnerOverrides.concurrency = Math.min(
          parsedConcurrency,
          MAX_CONCURRENCY,
        );
      }
    }

    const configOverrides: Record<string, unknown> = {};
    if (driverInput === 'storybook' || (!driverInput && !urlsInput)) {
      configOverrides.drivers = {
        driver: 'storybook',
        url: storybookUrl || undefined,
        buildDir: storybookBuildDir || undefined,
      };
    } else if (driverInput === 'url' || urlsInput) {
      let urls: Array<string> = ['/'];
      if (urlsInput) {
        try {
          urls = urlsInput.startsWith('[')
            ? JSON.parse(urlsInput)
            : urlsInput
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean);
        } catch {
          urls = urlsInput
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean);
        }
      }
      configOverrides.drivers = {
        driver: 'url',
        baseUrl: storybookUrl || undefined,
        urls,
      };
    } else {
      configOverrides.drivers = driverInput;
    }

    if (Object.keys(snapshotOverrides).length > 0)
      configOverrides.snapshot = snapshotOverrides;
    if (Object.keys(runnerOverrides).length > 0)
      configOverrides.runner = runnerOverrides;

    // 4. GitHub PR Comment & Commit Status Configuration
    const repoOwner = github.context.repo.repo
      ? github.context.repo.owner
      : undefined;
    const repoName = github.context.repo.repo;
    const repoString =
      repoOwner && repoName
        ? `${repoOwner}/${repoName}`
        : process.env.GITHUB_REPOSITORY;
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
    const viewerUrl =
      viewerUrlInput || process.env.DIFFRA_VIEWER_URL || autoPagesUrl;

    if (viewerUrl) {
      configOverrides.viewerUrl = viewerUrl;
    }

    // 5. Test Execution
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
    const reportUrl = viewerUrl
      ? `${viewerUrl.replace(/\/$/, '')}/?run=${report.runId}`
      : `file://${reportJsonPath}`;

    if (token && repoString) {
      configOverrides.notifier = {
        github: {
          token,
          repo: repoString,
          prNumber,
          viewerUrl,
          reportUrl,
        },
      };
    }

    // 6. Standard Action Outputs
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

    // 7. GitHub Actions Job Step Summary
    try {
      const summaryMarkdown = formatMarkdownSummary(
        report,
        reportUrl,
        viewerUrl,
      );
      await core.summary.addRaw(summaryMarkdown).write();
    } catch {}

    // 8. Emit GitHub Annotations / Warnings for Changed Targets
    for (const result of report.results) {
      if (result.status === 'changed') {
        const pct = result.diff?.diffPercentage.toFixed(2) ?? '0.00';
        const count = result.diff?.diffCount.toLocaleString() ?? '0';
        const groupName = result.group || 'Component';
        core.warning(
          `Visual diff detected in "${groupName} / ${result.name}" [${result.viewport.width}x${result.viewport.height}]: ${pct}% change (${count} pixels).`,
          {
            title: `Visual Change: ${groupName} - ${result.name}`,
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

    // 9. Auto-Accept on Merge or Target Branch
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
      await stopPreviewServer(staticServer);
    }
  }
}

if (process.env.GITHUB_ACTIONS) {
  run();
}
