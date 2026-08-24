import { resolvePullRequestNumber } from '../../notifier/github.js';
import {
  formatMarkdownSummary,
  SYNDETIC_COMMENT_MARKER,
} from '../../notifier/summary.js';
import type { NotifierAdapter, TestRunReport } from '../../types/index.js';

export interface GitHubNotifierOptions {
  token?: string;
  repo?: string;
  prNumber?: number;
  reportUrl?: string;
  viewerUrl?: string;
}

export class GitHubNotifier implements NotifierAdapter {
  name = 'github';
  private token?: string;
  private repo?: string;
  private prNumber?: number;
  private reportUrl?: string;
  private viewerUrl?: string;

  constructor(options: GitHubNotifierOptions = {}) {
    this.token = options.token || process.env.GITHUB_TOKEN;
    this.repo = options.repo || process.env.GITHUB_REPOSITORY;
    this.prNumber = options.prNumber;
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
    if (report.commit && report.commit !== 'uncommitted') {
      try {
        const state = report.summary.changed > 0 ? 'failure' : 'success';
        const description =
          report.summary.changed > 0
            ? `Found ${report.summary.changed} visual diffs.`
            : 'All visual regressions passed.';

        const checkUrl = `https://api.github.com/repos/${this.repo}/statuses/${report.commit}`;
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
      } catch {}
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
              c.body?.includes(SYNDETIC_COMMENT_MARKER) ||
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
      } catch {}
    }
  }
}

export function createGitHubNotifier(
  options?: GitHubNotifierOptions,
): NotifierAdapter {
  return new GitHubNotifier(options);
}
