import fs from 'node:fs/promises';
import { decisionsNeeded } from '../../report/gate.js';
import type { NotifierAdapter, TestRunReport } from '../../types/index.js';
import { DIFFRA_COMMENT_MARKER, formatMarkdownSummary } from './summary.js';

export interface GitHubNotifierOptions {
  token?: string;
  repo?: string;
  prNumber?: number;
  commitSha?: string;
  /** Review link, or a function building it once the run id is known */
  reportUrl?: string | ((report: TestRunReport) => string);
  /** REST API base, for GitHub Enterprise Server (default: GITHUB_API_URL) */
  apiUrl?: string;
}

export const DEFAULT_GITHUB_API_URL = 'https://api.github.com';

/**
 * Resolves the pull request number from options or GitHub Actions environment.
 */
export async function resolvePullRequestNumber(
  explicitPrNumber?: number,
): Promise<number | undefined> {
  if (explicitPrNumber && !Number.isNaN(explicitPrNumber)) {
    return explicitPrNumber;
  }

  if (process.env.GITHUB_PR_NUMBER) {
    const parsed = parseInt(process.env.GITHUB_PR_NUMBER, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const ref = process.env.GITHUB_REF || '';
  const pullRefMatch = ref.match(/^refs\/pull\/(\d+)\/(merge|head)$/);
  if (pullRefMatch?.[1]) {
    const parsed = parseInt(pullRefMatch[1], 10);
    if (!Number.isNaN(parsed)) return parsed;
  }

  if (process.env.GITHUB_EVENT_PATH) {
    try {
      const eventContent = await fs.readFile(
        process.env.GITHUB_EVENT_PATH,
        'utf-8',
      );
      const payload = JSON.parse(eventContent);
      const prNumber =
        payload.pull_request?.number || payload.issue?.number || payload.number;
      if (typeof prNumber === 'number' && !Number.isNaN(prNumber)) {
        return prNumber;
      }
    } catch {}
  }

  return undefined;
}

export class GitHubNotifier implements NotifierAdapter {
  name = 'github';
  private readonly token?: string;
  private readonly repo?: string;
  private readonly prNumber?: number;
  private readonly commitSha?: string;
  private readonly reportUrl?: string | ((report: TestRunReport) => string);
  private readonly apiUrl: string;

  constructor(options: GitHubNotifierOptions = {}) {
    this.token =
      options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    this.repo = options.repo || process.env.GITHUB_REPOSITORY;
    this.prNumber = options.prNumber;
    this.commitSha = options.commitSha;
    this.reportUrl = options.reportUrl;
    this.apiUrl = (
      options.apiUrl ||
      process.env.GITHUB_API_URL ||
      DEFAULT_GITHUB_API_URL
    ).replace(/\/+$/, '');
  }

  async notify(report: TestRunReport): Promise<void> {
    if (!this.token || !this.repo) {
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `token ${this.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Diffra-Visual-Regression-Action',
    };

    const reportUrl =
      (typeof this.reportUrl === 'function'
        ? this.reportUrl(report)
        : this.reportUrl) ?? report.links?.review;

    // 1. Commit Status Check
    const sha = this.commitSha || report.git?.commit;
    if (sha && sha !== 'uncommitted') {
      try {
        const { changed, failed } = report.summary;
        const needed = decisionsNeeded(report);
        const state = needed > 0 || failed > 0 ? 'failure' : 'success';
        const description =
          failed > 0
            ? `${failed} target${failed === 1 ? '' : 's'} could not be captured.`
            : needed > 0 && report.gate === 'collateral'
              ? `${needed} unintended visual change${needed === 1 ? '' : 's'}.`
              : needed > 0
                ? `Found ${needed} visual diffs.`
                : changed > 0
                  ? `${changed} visual change${changed === 1 ? '' : 's'}, all intended.`
                  : 'All visual regressions passed.';

        const checkUrl = `${this.apiUrl}/repos/${this.repo}/statuses/${sha}`;
        await fetch(checkUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            state,
            context: 'diffra/visual-tests',
            description,
            target_url: reportUrl,
          }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[diffra] Warning posting GitHub commit status check: ${msg}`,
        );
      }
    }

    // 2. PR Sticky Markdown Comment
    const prNumber = await resolvePullRequestNumber(this.prNumber);
    if (prNumber) {
      try {
        const body = formatMarkdownSummary(report, reportUrl);
        const commentsUrl = `${this.apiUrl}/repos/${this.repo}/issues/${prNumber}/comments`;

        const listRes = await fetch(commentsUrl, { headers });

        if (listRes.ok) {
          const rawComments: unknown = await listRes.json();
          const comments = Array.isArray(rawComments)
            ? (rawComments as Array<{ id: number; body?: string }>)
            : [];
          const existing = comments.find(
            (c) =>
              typeof c === 'object' &&
              c !== null &&
              typeof c.body === 'string' &&
              (c.body.includes(DIFFRA_COMMENT_MARKER) ||
                c.body.includes('Diffra Visual Regression')),
          );

          if (existing) {
            await fetch(
              `${this.apiUrl}/repos/${this.repo}/issues/comments/${existing.id}`,
              {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ body }),
              },
            );
            return;
          }
        }

        await fetch(commentsUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ body }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[diffra] Warning posting GitHub PR comment: ${msg}`);
      }
    }
  }
}

export function createGitHubNotifier(
  options?: GitHubNotifierOptions,
): NotifierAdapter {
  return new GitHubNotifier(options);
}
