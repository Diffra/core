import type { TestRunReport } from '../types/index.js';
export const DIFFRA_COMMENT_MARKER = '<!-- diffra-visual-report -->';
export const SYNDETIC_COMMENT_MARKER = DIFFRA_COMMENT_MARKER;

/**
 * Formats a clean GitHub/GitLab markdown summary table for CI pull requests and Job Summaries.
 */
export function formatMarkdownSummary(
  report: TestRunReport,
  reportUrl?: string,
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

  if (reportUrl) {
    md += `👉 **[View Interactive Visual Report](${reportUrl})**\n\n`;
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

      md += `| **${item.component}** / ${item.name} | \`${item.viewport.width}x${item.viewport.height}\` | ${statusBadge} | ${diffPercent} | ${diffPixels} |\n`;
    }
    md += `\n`;

    md += `> **Review Note:** Merging this pull request into the base branch automatically approves and promotes these visual candidate snapshots as the new baseline.\n\n`;
  }

  md += `*Generated automatically by [Diffra](https://github.com/Rawlings/diffra) at ${report.timestamp}*`;
  return md;
}
