import fs from 'node:fs/promises';
import type { TestRunReport } from '../types/index.js';
import { formatMarkdownSummary, SYNDETIC_COMMENT_MARKER } from './summary.js';

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

/**
 * Posts sticky PR comment and commit status check to GitHub using standard fetch.
 */
export async function notifyGitHub(
  report: TestRunReport,
  options: GitHubNotifierOptions = {},
): Promise<void> {
  const token =
    options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repoString = options.repo || process.env.GITHUB_REPOSITORY;

  if (!token || !repoString) {
    return;
  }

  const prNumber = await resolvePullRequestNumber(options.prNumber);
  const markdown = formatMarkdownSummary(
    report,
    options.reportUrl,
    options.viewerUrl,
  );

  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'Diffra-Visual-Regression-Action',
  };

  try {
    // 1. Post / Update Sticky PR Comment
    if (prNumber) {
      const commentsUrl = `https://api.github.com/repos/${repoString}/issues/${prNumber}/comments`;
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
            `https://api.github.com/repos/${repoString}/issues/comments/${existing.id}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ body: markdown }),
            },
          );
        } else {
          await fetch(commentsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ body: markdown }),
          });
        }
      }
    }

    // 2. Set Commit Status Check
    const sha = options.commitSha || report.commit;
    if (sha && sha !== 'uncommitted') {
      const state = report.summary.changed > 0 ? 'failure' : 'success';
      const description =
        report.summary.changed > 0
          ? `${report.summary.changed} visual diffs detected`
          : 'All visual regression tests passed';

      const statusUrl = `https://api.github.com/repos/${repoString}/statuses/${sha}`;
      await fetch(statusUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          state,
          context: 'diffra/visual-tests',
          description,
          target_url: options.reportUrl,
        }),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[diffra] Could not post GitHub notification: ${message}`);
  }
}
