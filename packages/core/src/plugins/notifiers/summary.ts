import { decisionsNeeded } from '../../report/gate.js';
import type { TestRunReport, VisualTestResult } from '../../types/index.js';

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
  const needed = decisionsNeeded(report);
  const hasChanges = needed > 0 || summary.removed > 0;
  const classified = summary.collateral !== undefined;
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? '' : 's'}`;
  const statusIcon = hasFailures ? '❌' : hasChanges ? '⚠️' : '✅';
  const statusTitle = hasFailures
    ? `${plural(summary.failed, 'target')} could not be captured`
    : classified && report.gate === 'collateral' && needed > 0
      ? `${plural(needed, 'unintended visual change')}${summary.intended ? ` (${summary.intended} intended)` : ''}`
      : classified && !hasChanges && summary.changed > 0
        ? `${plural(summary.changed, 'visual change')}, all intended`
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

  md += formatCauses(report);

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

const CHANGE_ICON: Record<string, string> = {
  changed: '🟠',
  added: '🟢',
  removed: '🔴',
};

function causeLine(result: VisualTestResult): string {
  const kind = result.classification?.kind;
  const label = kind ? ` _(${kind})_` : '';
  const why =
    result.explanation?.summary ??
    result.classification?.reason ??
    `Snapshot ${result.status}; no page context was recorded for it.`;
  const icon =
    kind === 'intended' ? '✅' : (CHANGE_ICON[result.status] ?? '🟠');
  return `- ${icon} **${result.group || 'Component'} / ${result.name}**${label}: ${why}`;
}

/**
 * What changed and why, in words, before any table: the declared intent, then
 * each change with its cause, unintended changes first.
 */
export function formatCauses(report: TestRunReport): string {
  const changes = report.results.filter(
    (r) =>
      r.status === 'changed' || r.status === 'added' || r.status === 'removed',
  );
  const explained = changes.filter((r) => r.explanation || r.classification);
  let md = '';

  if (report.intents && report.intents.length > 0) {
    md += `### Declared intent\n\n`;
    for (const intent of report.intents) {
      md += `- ${intent.description} _(${intent.author})_\n`;
    }
    md += `\n`;
  }

  if (explained.length > 0) {
    const order = (r: VisualTestResult) =>
      r.classification?.kind === 'collateral' ? 0 : 1;
    md += `### What changed\n\n`;
    for (const result of [...explained].sort((a, b) => order(a) - order(b))) {
      md += `${causeLine(result)}\n`;
    }
    md += `\n`;
  }
  return md;
}
