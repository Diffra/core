import type { TestRunReport } from '../types/index.js';
export const DIFFRA_COMMENT_MARKER = '<!-- diffra-visual-report -->';
export const SYNDETIC_COMMENT_MARKER = DIFFRA_COMMENT_MARKER;

/**
 * Formats a clean GitHub/GitLab markdown summary table for CI pull requests and Job Summaries.
 */
export function formatMarkdownSummary(
  report: TestRunReport,
  reportUrl?: string,
  viewerUrl?: string,
): string {
  const { summary, results, branch, commit, baselineCommit } = report;
  const hasChanges = summary.changed > 0 || summary.removed > 0;
  const statusIcon = hasChanges ? '⚠️' : '✅';
  const statusTitle = hasChanges
    ? `Visual Regression Detected (${summary.changed} changed)`
    : `All Visual Tests Passed (${summary.total} stories)`;

  let md = `${DIFFRA_COMMENT_MARKER}\n`;
  md += `## ${statusIcon} Diffra Visual Regression: ${statusTitle}\n\n`;

  md += `| Total | Changed | Added | Removed | Passed |\n`;
  md += `| :---: | :---: | :---: | :---: | :---: |\n`;
  md += `| **${summary.total}** | **${summary.changed > 0 ? `🟠 ${summary.changed}` : '0'}** | **${summary.added > 0 ? `🟢 ${summary.added}` : '0'}** | **${summary.removed > 0 ? `🔴 ${summary.removed}` : '0'}** | **${summary.unchanged}** |\n\n`;

  md += `**Branch:** \`${branch}\` | **Commit:** \`${commit.slice(0, 7)}\` | **Baseline:** \`${baselineCommit ? baselineCommit.slice(0, 7) : 'None'}\`\n\n`;

  const configuredViewer =
    viewerUrl ||
    process.env.DIFFRA_VIEWER_URL ||
    process.env.GITHUB_PAGES_URL;

  let interactiveUrl = reportUrl;
  if (configuredViewer && reportUrl && !reportUrl.startsWith('file://')) {
    const cleanViewer = configuredViewer.replace(/\/$/, '');
    interactiveUrl = `${cleanViewer}/?report=${encodeURIComponent(reportUrl)}`;
  }

  if (interactiveUrl) {
    md += `👉 **[View Interactive Visual Report](${interactiveUrl})**\n\n`;
  }

  const changedStories = results.filter(
    (r) =>
      r.status === 'changed' || r.status === 'added' || r.status === 'removed',
  );

  if (changedStories.length > 0) {
    md += `### Changed Components\n\n`;
    md += `| Component / Story | Viewport | Status | Diff % | Changed Pixels |\n`;
    md += `| :--- | :--- | :---: | :---: | :---: |\n`;

    for (const item of changedStories) {
      const diffPercent = item.diffResult
        ? `${item.diffResult.diffPercentage.toFixed(2)}%`
        : '-';
      const diffPixels = item.diffResult
        ? item.diffResult.diffCount.toLocaleString()
        : '-';
      const statusBadge =
        item.status === 'changed'
          ? '🟠 Changed'
          : item.status === 'added'
            ? '🟢 Added'
            : '🔴 Removed';

      const storyLink = interactiveUrl
        ? `${interactiveUrl}#/story/${encodeURIComponent(item.id)}`
        : undefined;
      const storyLabel = storyLink
        ? `[**${item.component}** / ${item.name}](${storyLink})`
        : `**${item.component}** / ${item.name}`;

      md += `| ${storyLabel} | \`${item.viewport.width}x${item.viewport.height}\` | ${statusBadge} | ${diffPercent} | ${diffPixels} |\n`;
    }
    md += `\n`;

    md += `> **Review Note:** Merging this pull request into the base branch automatically approves and promotes these visual candidate snapshots as the new baseline.\n\n`;
  }

  md += `*Generated automatically by [Diffra](https://github.com/Diffra/core) at ${report.timestamp}*`;
  return md;
}
