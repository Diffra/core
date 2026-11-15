import { describe, expect, it } from 'vitest';
import { withoutDirectory } from '../../src/pipeline/affected.js';
import { compareRuns } from '../../src/pipeline/verify.js';
import type { TestRunReport, VisualTestResult } from '../../src/types/index.js';

const result = (
  id: string,
  status: VisualTestResult['status'],
): VisualTestResult => ({
  id,
  name: id,
  viewport: { width: 100, height: 100 },
  browser: 'chromium',
  status,
  candidate: {},
});

const report = (...results: VisualTestResult[]): TestRunReport => ({
  runId: 'r',
  timestamp: 't',
  git: { branch: 'b', commit: 'c' },
  summary: {
    total: results.length,
    passed: 0,
    changed: 0,
    added: 0,
    removed: 0,
    failed: 0,
    unchanged: 0,
  },
  results,
});

describe('compareRuns', () => {
  it('sorts open changes into resolved, still changed, new and not checked', () => {
    const v = compareRuns(
      report(
        result('a', 'changed'),
        result('b', 'changed'),
        result('c', 'unchanged'),
        result('d', 'changed'),
      ),
      report(
        result('a', 'unchanged'),
        result('b', 'changed'),
        result('c', 'changed'),
      ),
    );
    expect(v.resolved.map((r) => r.id)).toEqual(['a']);
    expect(v.stillChanged.map((r) => r.id)).toEqual(['b']);
    expect(v.newlyChanged.map((r) => r.id)).toEqual(['c']);
    expect(v.notChecked.map((r) => r.id)).toEqual(['d']);
    expect(v.summary).toBe(
      '1 resolved, 1 still changed, 1 newly changed, 1 not checked in this run.',
    );
  });

  it('says so when nothing was open and nothing changed', () => {
    expect(
      compareRuns(undefined, report(result('a', 'unchanged'))).summary,
    ).toMatch(/Nothing was open/);
  });
});

describe('withoutDirectory', () => {
  it('drops the files inside a directory and nothing else', () => {
    const files = [
      '.diffra/runs/a/report.json',
      '.diffra',
      'src/a.css',
      '.diffra-notes.md',
    ];
    expect(withoutDirectory(files, '.diffra')).toEqual([
      'src/a.css',
      '.diffra-notes.md',
    ]);
  });

  it('keeps everything for an output directory outside the project, or none', () => {
    const files = ['src/a.css'];
    expect(withoutDirectory(files, '../elsewhere')).toEqual(files);
    expect(withoutDirectory(files, '')).toEqual(files);
  });
});
