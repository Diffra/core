import type { TestRunReport } from '../../types/index.js';

export const DIFFRA_COMMENT_MARKER = '<!-- diffra-visual-report -->';

/**
 * Formats a clean markdown summary table for CI pull requests and Job Step Summaries.
 */
export function formatMarkdownSummary(
  report: TestRunReport,
  reportUrl?: string,
  viewerUrl?: string,
): string {
  const { summary, results, git } = report;
  const hasChanges = summary.changed > 0 || summary.removed > 0;
  const statusIcon = hasChanges ? '⚠️' : '✅';
  const statusTitle = hasChanges
    ? `Visual Regression Detected (${summary.changed} changed)`
    : `All Visual Tests Passed (${summary.total} targets)`;

  let md = `${DIFFRA_COMMENT_MARKER}\n`;
  md += `## ${statusIcon} Diffra Visual Regression: ${statusTitle}\n\n`;

  md += `| Total | Changed | Added | Removed | Passed |\n`;
  md += `| :---: | :---: | :---: | :---: | :---: |\n`;
  md += `| **${summary.total}** | **${summary.changed > 0 ? `🟠 ${summary.changed}` : '0'}** | **${summary.added > 0 ? `🟢 ${summary.added}` : '0'}** | **${summary.removed > 0 ? `🔴 ${summary.removed}` : '0'}** | **${summary.passed ?? summary.unchanged}** |\n\n`;

  const branch = git?.branch || 'main';
  const commit = git?.commit || '';
  const baselineCommit = git?.baselineCommit;
  md += `**Branch:** \`${branch}\` | **Commit:** \`${commit.slice(0, 7)}\` | **Baseline:** \`${baselineCommit ? baselineCommit.slice(0, 7) : 'None'}\`\n\n`;

  const configuredViewer =
    viewerUrl || process.env.DIFFRA_VIEWER_URL || process.env.GITHUB_PAGES_URL;

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
    md += `### Changed Targets\n\n`;
    md += `| Target | Viewport | Status | Diff % | Changed Pixels |\n`;
    md += `| :--- | :--- | :---: | :---: | :---: |\n`;

    for (const item of changedStories) {
      const diffPercent = item.diff
        ? `${item.diff.diffPercentage.toFixed(2)}%`
        : '-';
      const diffPixels = item.diff
        ? item.diff.diffCount.toLocaleString()
        : '-';
      const statusBadge =
        item.status === 'changed'
          ? '🟠 Changed'
          : item.status === 'added'
            ? '🟢 Added'
            : '🔴 Removed';

      const groupName = item.group || 'Component';
      const storyLink = interactiveUrl
        ? `${interactiveUrl}#/story/${encodeURIComponent(item.id)}`
        : undefined;
      const storyLabel = storyLink
        ? `[**${groupName}** / ${item.name}](${storyLink})`
        : `**${groupName}** / ${item.name}`;

      md += `| ${storyLabel} | \`${item.viewport.width}x${item.viewport.height}\` | ${statusBadge} | ${diffPercent} | ${diffPixels} |\n`;
    }
    md += `\n`;

    md += `> **Review Note:** Merging this pull request into the base branch automatically promotes candidate snapshots to baseline.\n\n`;
  }

  md += `*Generated automatically by [Diffra](https://github.com/Diffra/core) at ${report.timestamp}*`;
  return md;
}
