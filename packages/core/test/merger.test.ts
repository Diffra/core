import { describe, expect, it } from 'vitest';
import { mergeReports } from '../src/report/merger.js';
import type { TestRunReport } from '../src/types/index.js';

describe('mergeReports', () => {
  it('combines multiple shard reports and recalculates summary tallies', async () => {
    const report1: TestRunReport = {
      runId: 'shard-run-1',
      timestamp: '2026-08-25T12:00:00Z',
      branch: 'feature-branch',
      commit: 'abc1234',
      baselineBranch: 'main',
      summary: { total: 1, changed: 1, added: 0, removed: 0, unchanged: 0 },
      results: [
        {
          id: 'button--primary',
          name: 'Primary',
          component: 'Button',
          viewport: { width: 1280, height: 800 },
          status: 'changed',
        },
      ],
    };

    const report2: TestRunReport = {
      runId: 'shard-run-2',
      timestamp: '2026-08-25T12:00:00Z',
      branch: 'feature-branch',
      commit: 'abc1234',
      baselineBranch: 'main',
      summary: { total: 1, changed: 0, added: 1, removed: 0, unchanged: 0 },
      results: [
        {
          id: 'badge--default',
          name: 'Default',
          component: 'Badge',
          viewport: { width: 1280, height: 800 },
          status: 'added',
        },
      ],
    };

    const merged = await mergeReports([report1, report2]);
    expect(merged.results).toHaveLength(2);
    expect(merged.summary.total).toBe(2);
    expect(merged.summary.changed).toBe(1);
    expect(merged.summary.added).toBe(1);
    expect(merged.summary.unchanged).toBe(0);
    expect(merged.branch).toBe('feature-branch');
  });
});
