import fs from 'node:fs/promises';
import { DIFFRA_COMMENT_MARKER, formatMarkdownSummary } from './summary.js';
import type { NotifierAdapter, TestRunReport } from '../../types/index.js';

export interface GitHubNotifierOptions {
  token?: string;
  repo?: string;
  prNumber?: number;
  commitSha?: string;
  reportUrl?: string;
  viewerUrl?: string;
}

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
  private token?: string;
  private repo?: string;
  private prNumber?: number;
  private commitSha?: string;
  private reportUrl?: string;
  private viewerUrl?: string;

  constructor(options: GitHubNotifierOptions = {}) {
    this.token =
      options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    this.repo = options.repo || process.env.GITHUB_REPOSITORY;
    this.prNumber = options.prNumber;
    this.commitSha = options.commitSha;
    this.reportUrl = options.reportUrl;
    this.viewerUrl = options.viewerUrl || process.env.DIFFRA_VIEWER_URL;
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

    // 1. Commit Status Check
    const sha = this.commitSha || report.git?.commit;
    if (sha && sha !== 'uncommitted') {
      try {
        const state = report.summary.changed > 0 ? 'failure' : 'success';
        const description =
          report.summary.changed > 0
            ? `Found ${report.summary.changed} visual diffs.`
            : 'All visual regressions passed.';

        const checkUrl = `https://api.github.com/repos/${this.repo}/statuses/${sha}`;
        await fetch(checkUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            state,
            context: 'diffra/visual-tests',
            description,
            target_url: this.reportUrl,
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
        const body = formatMarkdownSummary(
          report,
          this.reportUrl,
          this.viewerUrl,
        );
        const commentsUrl = `https://api.github.com/repos/${this.repo}/issues/${prNumber}/comments`;

        const listRes = await fetch(commentsUrl, { headers });

        if (listRes.ok) {
          const comments = (await listRes.json()) as Array<{
            id: number;
            body?: string;
          }>;
          const existing = comments.find(
            (c) =>
              c.body?.includes(DIFFRA_COMMENT_MARKER) ||
              c.body?.includes('Diffra Visual Regression'),
          );

          if (existing) {
            await fetch(
              `https://api.github.com/repos/${this.repo}/issues/comments/${existing.id}`,
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
