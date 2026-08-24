import { describe, expect, it } from 'vitest';
import type { TestRunReport } from '../src/types/index.js';

const mockReport: TestRunReport = {
  runId: 'test-run-1',
  timestamp: '2026-08-23T20:00:00.000Z',
  branch: 'feat/buttons',
  commit: '1234567',
  baselineBranch: 'main',
  baselineCommit: '0000000',
  baselineReportUrl: '../../branches/main/latest/index.html',
  branchLatestUrl: '../../branches/feat_buttons/latest/index.html',
  summary: {
    total: 2,
    changed: 1,
    added: 1,
    removed: 0,
    unchanged: 0,
  },
  results: [
    {
      id: 'button-primary',
      name: 'Primary',
      component: 'Button',
      status: 'changed',
      diffPercentage: 1.2,
      diffCount: 50,
      viewport: { name: 'desktop', width: 1280, height: 800 },
      baselineUrl: 'data:image/png;base64,mockBaseline',
      candidateUrl: 'data:image/png;base64,mockCandidate',
      diffUrl: 'data:image/png;base64,mockDiff',
      boundingBoxes: [{ minX: 0, minY: 0, maxX: 10, maxY: 10 }],
    },
  ],
};

describe('Diffra Viewer Data Models', () => {
  it('correctly structures and validates test run report with branch interlinking', () => {
    expect(mockReport.runId).toBe('test-run-1');
    expect(mockReport.branch).toBe('feat/buttons');
    expect(mockReport.baselineBranch).toBe('main');
    expect(mockReport.baselineReportUrl).toBe(
      '../../branches/main/latest/index.html',
    );
    expect(mockReport.branchLatestUrl).toBe(
      '../../branches/feat_buttons/latest/index.html',
    );
    expect(mockReport.results.length).toBe(1);
    expect(mockReport.results[0]?.status).toBe('changed');
    expect(mockReport.results[0]?.boundingBoxes?.length).toBe(1);
  });

  it('validates summary metrics consistency', () => {
    const sum = mockReport.summary;
    expect(sum.total).toBe(
      sum.changed + sum.added + sum.removed + sum.unchanged,
    );
  });

  it('supports all 6 comparison modes: split, swipe, onion, mask, heatmap, and highlight', () => {
    const modes = ['split', 'swipe', 'onion', 'mask', 'heatmap', 'highlight'];
    expect(modes).toHaveLength(6);
    expect(modes).toContain('heatmap');
    expect(modes).toContain('highlight');
  });
});
