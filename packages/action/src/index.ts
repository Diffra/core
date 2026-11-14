import path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  approveBaselines,
  createGitHubNotifier,
  formatMarkdownSummary,
  runVisualRegression,
  type TestRunReport,
} from '@diffra/core';
import { matchesBranchOrBool } from './branch.js';
import {
  createPreviewHandler,
  formatServerUrl,
  startPreviewServer,
  stopPreviewServer,
} from './preview-server.js';
import { chooseReviewLink, workflowRunUrl } from './review.js';

export {
  createPreviewHandler,
  formatServerUrl,
  matchesBranchOrBool,
  startPreviewServer,
  stopPreviewServer,
};

const MAX_CONCURRENCY = 16;
const DEFAULT_EXIT_ZERO_ON_CHANGES = 'true';
const DEFAULT_AUTO_ACCEPT = 'default-branch';
const PULL_REQUEST_REF = /^refs\/pull\/(\d+)\/(merge|head)$/;

/** Splits a comma separated list or JSON array input into trimmed entries. */
export function parseList(input: string): string[] {
  const fromCsv = (value: string) =>
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  if (!input.startsWith('[')) return fromCsv(input);
  try {
    const parsed: unknown = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.map(String) : fromCsv(input);
  } catch {
    return fromCsv(input);
  }
}

interface DriverInputs {
  driver: string;
  urls: string;
  storybookBuildDir: string;
  storybookUrl: string;
}

/**
 * Chooses the driver configuration implied by the action inputs. Returns
 * undefined when no input asks for a driver, so that the repository's own
 * configuration (diffra.config.ts) stays in charge.
 */
export function driverFromInputs(inputs: DriverInputs): unknown {
  const { driver, urls, storybookBuildDir, storybookUrl } = inputs;

  if (driver === 'url' || (!driver && urls)) {
    return {
      driver: 'url',
      baseUrl: storybookUrl || undefined,
      urls: urls ? parseList(urls) : ['/'],
    };
  }
  if (
    driver === 'storybook' ||
    (!driver && (storybookBuildDir || storybookUrl))
  ) {
    return {
      driver: 'storybook',
      url: storybookUrl || undefined,
      buildDir: storybookBuildDir || undefined,
    };
  }
  return driver || undefined;
}

function maskSecrets(token: string | undefined): void {
  if (token) core.setSecret(token);

  const sensitiveEnvKeys = [
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
    'AZURE_STORAGE_CONNECTION_STRING',
    'AZURE_STORAGE_KEY',
    'SLACK_WEBHOOK_URL',
    'FIGMA_ACCESS_TOKEN',
  ];
  for (const key of sensitiveEnvKeys) {
    const value = process.env[key];
    if (value) core.setSecret(value);
  }
}

function pullRequestNumber(): number | undefined {
  const fromPayload = github.context.payload.pull_request?.number;
  if (fromPayload) return fromPayload;
  const match = process.env.GITHUB_REF?.match(PULL_REQUEST_REF);
  return match?.[1] ? Number(match[1]) : undefined;
}

function logSummary(report: TestRunReport, reportUrl: string): void {
  const { summary } = report;
  core.info('\nTest Run Summary:');
  core.info(`  Total:     ${summary.total}`);
  core.info(`  Passed:    ${summary.unchanged}`);
  core.info(`  Added:     ${summary.added}`);
  core.info(`  Changed:   ${summary.changed}`);
  core.info(`  Failed:    ${summary.failed}`);
  core.info(`  Report:    ${reportUrl}\n`);
}

function annotateChanges(report: TestRunReport): void {
  for (const result of report.results) {
    if (result.status === 'changed') {
      const pct = result.diff?.diffPercentage.toFixed(2) ?? '0.00';
      const count = result.diff?.diffCount.toLocaleString() ?? '0';
      const groupName = result.group || 'Component';
      core.warning(
        `Visual diff detected in "${groupName} / ${result.name}" [${result.viewport.width}x${result.viewport.height}]: ${pct}% change (${count} pixels).`,
        { title: `Visual Change: ${groupName} - ${result.name}` },
      );
    } else if (result.status === 'failed') {
      const groupName = result.group || 'Component';
      core.error(
        `Could not capture "${groupName} / ${result.name}": ${result.error ?? 'unknown error'}`,
        { title: `Capture failed: ${groupName} - ${result.name}` },
      );
    }
  }
}

export async function run(): Promise<void> {
  let staticServer: import('node:http').Server | null = null;
  const currentRef = github.context.ref || process.env.GITHUB_REF || '';

  try {
    const token = core.getInput('token') || process.env.GITHUB_TOKEN;
    maskSecrets(token);

    const debug = core.getInput('debug') === 'true';
    const verbose = (message: string) => {
      if (debug) core.info(`[debug] ${message}`);
    };

    const workingDir = path.resolve(
      process.cwd(),
      core.getInput('workingDir') || '.',
    );

    const exitZeroInput =
      core.getInput('exitZeroOnChanges') || DEFAULT_EXIT_ZERO_ON_CHANGES;
    const autoAcceptInput =
      core.getInput('autoAcceptChanges') || DEFAULT_AUTO_ACCEPT;
    const defaultBranch = github.context.payload.repository?.default_branch;

    const shouldExitZeroOnChanges = matchesBranchOrBool(
      exitZeroInput,
      currentRef,
      defaultBranch,
    );
    const shouldAutoAccept = matchesBranchOrBool(
      autoAcceptInput,
      currentRef,
      defaultBranch,
    );
    const shouldExitOnceUploaded = matchesBranchOrBool(
      core.getInput('exitOnceUploaded'),
      currentRef,
      defaultBranch,
    );

    // Serve a pre-built static site on a dynamic port when no URL was given.
    const storybookBuildDir = core.getInput('storybookBuildDir');
    let storybookUrl = core.getInput('storybookUrl');
    if (storybookBuildDir && !storybookUrl) {
      const portInput = core.getInput('storybookPort');
      const preview = await startPreviewServer({
        root: path.resolve(workingDir, storybookBuildDir),
        port: portInput ? Number.parseInt(portInput, 10) : 0,
      });
      staticServer = preview.server;
      storybookUrl = preview.url;
      core.info(`Started static preview server on ${storybookUrl}`);
    }

    // Configuration overrides derived from the action inputs
    const snapshot: Record<string, unknown> = {};
    const thresholdInput = core.getInput('diffThreshold');
    if (thresholdInput) {
      const threshold = Number.parseFloat(thresholdInput);
      if (!Number.isNaN(threshold) && threshold >= 0 && threshold <= 1) {
        snapshot.diffThreshold = threshold;
      }
    }

    const runner: Record<string, unknown> = { installBrowsers: true };
    const concurrencyInput = core.getInput('concurrency');
    if (concurrencyInput) {
      const concurrency = Number.parseInt(concurrencyInput, 10);
      if (!Number.isNaN(concurrency) && concurrency > 0) {
        runner.concurrency = Math.min(concurrency, MAX_CONCURRENCY);
      }
    }

    const configOverrides: Record<string, unknown> = { runner };
    if (Object.keys(snapshot).length > 0) configOverrides.snapshot = snapshot;

    const drivers = driverFromInputs({
      driver: core.getInput('driver'),
      urls: core.getInput('urls'),
      storybookBuildDir,
      storybookUrl,
    });
    if (drivers !== undefined) configOverrides.drivers = drivers;

    const { owner, repo } = github.context.repo;
    const repoSlug =
      owner && repo ? `${owner}/${repo}` : process.env.GITHUB_REPOSITORY;
    const reportBaseUrl = core.getInput('reportBaseUrl');
    if (reportBaseUrl) configOverrides.reportBaseUrl = reportBaseUrl;

    verbose(`working directory: ${workingDir}`);
    verbose(`config overrides: ${JSON.stringify(configOverrides)}`);

    core.info('Starting Diffra visual regression test run...');
    const report = await runVisualRegression({
      cwd: workingDir,
      config: configOverrides,
      onProgress: (step, current, total) => {
        core.info(`[${current}/${total}] ${step}`);
      },
    });

    const reportUrl = chooseReviewLink({
      hosted: report.links?.review,
      workflowRun: workflowRunUrl(),
      reviewDir: report.reviewDir,
    });

    // The pull request comment and commit status need the finished report and
    // its review link, so they are posted here rather than during the run.
    if (token && repoSlug) {
      await createGitHubNotifier({
        token,
        repo: repoSlug,
        prNumber: pullRequestNumber(),
        reportUrl,
      }).notify(report);
    }

    core.setOutput('url', reportUrl);
    core.setOutput('reportDir', report.reviewDir);
    core.setOutput('buildUrl', reportUrl);
    core.setOutput('storybookUrl', storybookUrl || '');
    core.setOutput('changeCount', String(report.summary.changed));
    core.setOutput('failedCount', String(report.summary.failed));
    core.setOutput('storyCount', String(report.summary.total));

    logSummary(report, reportUrl);

    try {
      await core.summary
        .addRaw(formatMarkdownSummary(report, reportUrl))
        .write();
    } catch (error) {
      verbose(`could not write the job summary: ${String(error)}`);
    }

    annotateChanges(report);

    if (report.summary.failed > 0) {
      core.setOutput('code', '1');
      core.setOutput('status', 'failed');
      core.setFailed(
        `Diffra could not capture ${report.summary.failed} target(s). Baselines were not promoted.`,
      );
      return;
    }

    if (shouldExitOnceUploaded) {
      core.info('exitOnceUploaded flag matched. Exiting successfully.');
      core.setOutput('code', '0');
      core.setOutput('status', 'passed');
      return;
    }

    if (shouldAutoAccept) {
      core.info(
        `Promoting candidate snapshots as the new baseline for ${currentRef}...`,
      );
      const approved = await approveBaselines({
        cwd: workingDir,
        report,
      });
      core.info(
        `Successfully promoted ${approved.count} snapshots as baseline.`,
      );
      if (approved.failed > 0) {
        core.setOutput('code', '1');
        core.setOutput('status', 'failed');
        core.setFailed(
          `Diffra could not promote ${approved.failed} snapshot(s) as baseline.`,
        );
        return;
      }
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
  run().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
