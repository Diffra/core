import { describe, expect, it } from 'vitest';
import {
  DIFFRA_COMMENT_MARKER,
  formatMarkdownSummary,
  resolvePullRequestNumber,
} from '../src/plugins/notifiers/index.js';
import type { TestRunReport } from '../src/types/index.js';

describe('Notifier PR Markdown Summary', () => {
  it('formats clean markdown table with changed stories and marker', () => {
    const report: TestRunReport = {
      runId: 'ci-run-1',
      timestamp: '2026-08-23T20:00:00.000Z',
      git: {
        branch: 'feature/login-redesign',
        commit: 'f9e8d7c6b5a4',
        baselineCommit: '1a2b3c4d5e6f',
      },
      summary: {
        total: 4,
        passed: 1,
        changed: 2,
        added: 1,
        removed: 0,
        unchanged: 1,
      },
      results: [
        {
          id: 'button--primary',
          name: 'Primary',
          group: 'Button',
          viewport: { width: 1280, height: 800 },
          status: 'changed',
          diff: {
            diffCount: 120,
            diffPercentage: 0.85,
            isSameDimensions: true,
            width: 1280,
            height: 800,
            boundingBoxes: [{ minX: 10, minY: 10, maxX: 100, maxY: 50 }],
            hasDiff: true,
          },
        },
        {
          id: 'modal--confirm',
          name: 'Confirm',
          group: 'Modal',
          viewport: { width: 1280, height: 800 },
          status: 'added',
        },
      ],
    };

    const markdown = formatMarkdownSummary(
      report,
      'https://diffra.internal/reports/ci-run-1',
    );
    expect(markdown).toContain(DIFFRA_COMMENT_MARKER);
    expect(markdown).toContain(
      '## ⚠️ Diffra Visual Regression: Visual Regression Detected (2 changed)',
    );
    expect(markdown).toContain('🟠 2');
    expect(markdown).toContain('🟢 1');
    expect(markdown).toContain('**Button** / Primary');
    expect(markdown).toContain('0.85%');
    expect(markdown).toContain('View Interactive Visual Report');
    expect(markdown).toContain('Merging this pull request');
  });

  it('formats success badge when no visual differences exist', () => {
    const report: TestRunReport = {
      runId: 'ci-run-2',
      timestamp: '2026-08-23T20:00:00.000Z',
      git: {
        branch: 'fix/typo',
        commit: '99999999',
      },
      summary: {
        total: 10,
        passed: 10,
        changed: 0,
        added: 0,
        removed: 0,
        unchanged: 10,
      },
      results: [],
    };

    const markdown = formatMarkdownSummary(report);
    expect(markdown).toContain(DIFFRA_COMMENT_MARKER);
    expect(markdown).toContain(
      '## ✅ Diffra Visual Regression: All Visual Tests Passed (10 targets)',
    );
  });

  it('resolves PR numbers correctly', async () => {
    expect(await resolvePullRequestNumber(42)).toBe(42);

    const oldEnvRef = process.env.GITHUB_REF;
    process.env.GITHUB_REF = 'refs/pull/999/merge';
    expect(await resolvePullRequestNumber()).toBe(999);
    process.env.GITHUB_REF = oldEnvRef;
  });
});
