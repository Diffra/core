import { describe, expect, it } from 'vitest';
import {
  DIFFRA_COMMENT_MARKER,
  resolvePullRequestNumber,
} from '../../src/plugins/notifiers/index.js';
import { formatMarkdownSummary } from '../../src/plugins/notifiers/summary.js';
import type { TestRunReport } from '../../src/types/index.js';

describe('pull request markdown summary', () => {
  const sampleReport: TestRunReport = {
    runId: 'adv-run-999',
    timestamp: '2026-10-11T12:00:00Z',
    git: {
      branch: 'feature/login',
      commit: 'deadbeef123',
      baselineCommit: 'main456',
    },
    summary: {
      total: 3,
      passed: 1,
      unchanged: 1,
      changed: 1,
      added: 1,
      removed: 0,
      failed: 0,
    },
    results: [
      {
        id: 'btn-primary',
        name: 'Primary Button',
        group: 'Button',
        viewport: { width: 320, height: 480 },
        status: 'changed',
        candidate: {},
        diff: {
          diffPercentage: 1.45,
          diffCount: 120,
          isSameDimensions: true,
          width: 320,
          height: 480,
          boundingBoxes: [],
          hasDiff: true,
        },
      },
      {
        id: 'modal-terms',
        name: 'Terms Modal',
        group: 'Modal',
        viewport: { width: 800, height: 600 },
        status: 'added',
        candidate: {},
      },
    ],
  };

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
        failed: 0,
        unchanged: 1,
      },
      results: [
        {
          id: 'button--primary',
          name: 'Primary',
          group: 'Button',
          viewport: { width: 1280, height: 800 },
          status: 'changed',
          candidate: {},
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
          candidate: {},
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
        failed: 0,
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

  it('links the hosted review page and never a file:// link', () => {
    const reportUrl = 'https://review.diffra.io/runs/adv-run-999/';

    const summary = formatMarkdownSummary(sampleReport, reportUrl);

    // Must contain viewer URL
    expect(summary).toContain('https://review.diffra.io');
    expect(summary).toContain('👉 **[View Interactive Visual Report]');
    // Must NOT contain file://
    expect(summary).not.toContain('file://');
  });

  it('leaves out file:// links when the review page is only local', () => {
    const localReviewUrl =
      'file:///Users/rawlings/core/.diffra/runs/adv-run-999/index.html';

    const summary = formatMarkdownSummary(sampleReport, localReviewUrl);

    // Must NOT contain file:// anywhere in markdown
    expect(summary).not.toContain('file://');
    // Must NOT contain a broken [View Interactive Visual Report] link
    expect(summary).not.toContain('[View Interactive Visual Report]');
    // Changed targets must NOT have file:// links
    expect(summary).toContain('**Button** / Primary Button');
    expect(summary).not.toContain('](file://');
  });

  it('uses the hosted review link recorded in the report when none is passed', () => {
    const summary = formatMarkdownSummary({
      ...sampleReport,
      links: { review: 'https://reports.example.test/runs/adv-run-999/' },
    });

    expect(summary).toContain('https://reports.example.test/runs/adv-run-999/');
    expect(summary).toContain('[View Interactive Visual Report]');
  });
});
