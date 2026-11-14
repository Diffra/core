import { describe, expect, it } from 'vitest';
import { applyShard, buildTasks } from '../src/pipeline/plan.js';
import { sortResults, summarize } from '../src/pipeline/report.js';
import type {
  DiffraConfig,
  VisualTarget,
  VisualTestResult,
} from '../src/types/index.js';

const VIEWPORT = { width: 400, height: 300 };

function result(
  overrides: Partial<VisualTestResult> & Pick<VisualTestResult, 'id'>,
): VisualTestResult {
  return {
    name: overrides.id,
    viewport: VIEWPORT,
    status: 'unchanged',
    candidate: {},
    ...overrides,
  };
}

describe('applyShard', () => {
  const tasks = [1, 2, 3, 4, 5, 6];

  it('splits tasks into disjoint shards that cover everything', () => {
    const first = applyShard(tasks, '1/3');
    const second = applyShard(tasks, '2/3');
    const third = applyShard(tasks, '3/3');
    expect(first).toEqual([1, 4]);
    expect([...first, ...second, ...third].sort()).toEqual(tasks);
  });

  it('ignores a missing or invalid shard', () => {
    expect(applyShard(tasks, undefined)).toEqual(tasks);
    expect(applyShard(tasks, 'one/two')).toEqual(tasks);
    expect(applyShard(tasks, '0/3')).toEqual(tasks);
    expect(applyShard(tasks, '4/3')).toEqual(tasks);
  });
});

describe('buildTasks', () => {
  const target: VisualTarget = { id: 'button', name: 'Button' };
  const discovered = { targets: [target], driverFor: () => undefined };

  it('creates one task per project and viewport', () => {
    const config = {
      snapshot: { viewports: [400, { width: 800, height: 600 }] },
      runner: {
        projects: [
          { name: 'chromium', browser: 'chromium' as const },
          { name: 'firefox', browser: 'firefox' as const },
        ],
      },
    } as DiffraConfig;

    const tasks = buildTasks(discovered, config);
    expect(tasks).toHaveLength(4);
    expect(new Set(tasks.map((t) => t.project?.browser))).toEqual(
      new Set(['chromium', 'firefox']),
    );
  });

  it('lets a project that fixes its viewport replace the target viewports', () => {
    const config = {
      snapshot: { viewports: [400, 800] },
      runner: {
        projects: [
          {
            name: 'phone',
            browser: 'chromium' as const,
            use: { viewport: { width: 390, height: 844 } },
          },
        ],
      },
    } as DiffraConfig;

    const tasks = buildTasks(discovered, config);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.viewport).toMatchObject({ width: 390, height: 844 });
  });

  it('applies the shard after expanding tasks', () => {
    const many = {
      targets: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id })),
      driverFor: () => undefined,
    };
    const config = { snapshot: { viewports: [400] } } as DiffraConfig;
    expect(buildTasks(many, config, '1/2').map((t) => t.target.id)).toEqual([
      'a',
      'c',
    ]);
  });
});

describe('report helpers', () => {
  it('counts every status', () => {
    const summary = summarize([
      result({ id: 'a', status: 'changed' }),
      result({ id: 'b', status: 'added' }),
      result({ id: 'c', status: 'failed' }),
      result({ id: 'd' }),
      result({ id: 'e' }),
    ]);
    expect(summary).toEqual({
      total: 5,
      passed: 2,
      unchanged: 2,
      changed: 1,
      added: 1,
      removed: 0,
      failed: 1,
    });
  });

  it('orders results the same way whatever order they finished in', () => {
    const results = [
      result({ id: 'z', group: 'B', browser: 'chromium' }),
      result({ id: 'a', group: 'B', browser: 'firefox' }),
      result({ id: 'm', group: 'A', browser: 'chromium' }),
    ];
    const forward = sortResults(results).map((r) => r.id);
    const reversed = sortResults([...results].reverse()).map((r) => r.id);
    expect(forward).toEqual(['m', 'a', 'z']);
    expect(reversed).toEqual(forward);
  });
});
