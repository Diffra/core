import type { TestRunReport } from '../../types/index.js';

export const DIFFRA_COMMENT_MARKER = '<!-- diffra-visual-report -->';

/**
 * Formats a clean markdown summary table for CI pull requests and Job Step Summaries.
 */
export function formatMarkdownSummary(
  report: TestRunReport,
  reviewUrl?: string,
): string {
  const { summary, results, git } = report;
  const hasFailures = summary.failed > 0;
  const hasChanges = summary.changed > 0 || summary.removed > 0;
  const statusIcon = hasFailures ? '❌' : hasChanges ? '⚠️' : '✅';
  const statusTitle = hasFailures
    ? `${summary.failed} target${summary.failed === 1 ? '' : 's'} could not be captured`
    : hasChanges
      ? `Visual Regression Detected (${summary.changed} changed)`
      : `All Visual Tests Passed (${summary.total} targets)`;

  let md = `${DIFFRA_COMMENT_MARKER}\n`;
  md += `## ${statusIcon} Diffra Visual Regression: ${statusTitle}\n\n`;

  md += `| Total | Changed | Added | Removed | Failed | Passed |\n`;
  md += `| :---: | :---: | :---: | :---: | :---: | :---: |\n`;
  md += `| **${summary.total}** | **${summary.changed > 0 ? `🟠 ${summary.changed}` : '0'}** | **${summary.added > 0 ? `🟢 ${summary.added}` : '0'}** | **${summary.removed > 0 ? `🔴 ${summary.removed}` : '0'}** | **${summary.failed > 0 ? `❌ ${summary.failed}` : '0'}** | **${summary.passed ?? summary.unchanged}** |\n\n`;

  const branch = git?.branch || 'main';
  const commit = git?.commit || '';
  const baselineCommit = git?.baselineCommit;
  md += `**Branch:** \`${branch}\` | **Commit:** \`${commit.slice(0, 7)}\` | **Baseline:** \`${baselineCommit ? baselineCommit.slice(0, 7) : 'None'}\`\n\n`;

  // A file:// address only means something on the machine that produced it.
  const link = reviewUrl ?? report.links?.review;
  const interactiveUrl = link && !link.startsWith('file://') ? link : undefined;

  if (interactiveUrl) {
    md += `👉 **[View Interactive Visual Report](${interactiveUrl})**\n\n`;
  }

  const changedStories = results.filter(
    (r) =>
      r.status === 'changed' ||
      r.status === 'added' ||
      r.status === 'removed' ||
      r.status === 'failed',
  );

  if (changedStories.length > 0) {
    md += `### Changed Targets\n\n`;
    md += `| Target | Viewport | Status | Diff % | Changed Pixels |\n`;
    md += `| :--- | :--- | :---: | :---: | :---: |\n`;

    for (const item of changedStories) {
      const diffPercent = item.diff
        ? `${item.diff.diffPercentage.toFixed(2)}%`
        : '-';
      const diffPixels = item.diff ? item.diff.diffCount.toLocaleString() : '-';
      const statusBadge =
        item.status === 'changed'
          ? '🟠 Changed'
          : item.status === 'added'
            ? '🟢 Added'
            : item.status === 'failed'
              ? '❌ Failed'
              : '🔴 Removed';

      const groupName = item.group || 'Component';
      const storyLink =
        interactiveUrl && !interactiveUrl.startsWith('file://')
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
