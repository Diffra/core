import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addIntent,
  classifyResults,
  clearIntents,
  countClassifications,
  type Intent,
  readIntents,
} from '../../src/intent/index.js';
import type { Explanation } from '../../src/pipeline/explain.js';
import { decisionsNeeded } from '../../src/report/gate.js';
import type { VisualTestResult } from '../../src/types/index.js';

const VIEWPORT = { width: 100, height: 100 };

function cause(
  tag: string,
  source?: { origin: string; selector: string },
): Explanation['causes'][number] {
  return {
    element: { path: `body>${tag}`, tag },
    changes: [],
    ...(source ? { source } : {}),
    displaced: 0,
    confidence: 'attributed',
  };
}

function changed(
  id: string,
  explanation?: Explanation,
  group = 'Components',
): VisualTestResult {
  return {
    id,
    name: id,
    group,
    viewport: VIEWPORT,
    status: 'changed',
    candidate: {},
    ...(explanation ? { explanation } : {}),
  };
}

const explained = (...causes: Explanation['causes']): Explanation => ({
  summary: '',
  causes,
  regions: [
    {
      index: 0,
      box: { minX: 0, minY: 0, maxX: 9, maxY: 9 },
      causes: causes.map((_, i) => i),
    },
  ],
});

const intent = (overrides: Partial<Intent>): Intent => ({
  id: 'intent-1',
  description: 'Make the button bigger',
  author: 'agent',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const kindOf = (results: VisualTestResult[], id: string) =>
  results.find((r) => r.id === id)?.classification;

describe('classifyResults', () => {
  it('judges nothing when no intent was declared', () => {
    const results = [changed('button--primary')];
    expect(classifyResults(results, [])).toBe(results);
  });

  it('treats a snapshot named by a target as intended', () => {
    const results = classifyResults(
      [changed('button--primary'), changed('card--default')],
      [intent({ targets: ['button'] })],
    );
    expect(kindOf(results, 'button--primary')).toMatchObject({
      kind: 'intended',
      intent: 'intent-1',
    });
    expect(kindOf(results, 'card--default')).toMatchObject({
      kind: 'collateral',
    });
    expect(kindOf(results, 'card--default')?.reason).toMatch(
      /Not covered by a declared intent: it is not one of the declared targets/,
    );
  });

  it('matches a target against the group as well', () => {
    const results = classifyResults(
      [changed('x--y', undefined, 'Forms')],
      [intent({ targets: ['forms'] })],
    );
    expect(kindOf(results, 'x--y')?.kind).toBe('intended');
  });

  it('treats a change as intended when every cause is in a declared source', () => {
    const results = classifyResults(
      [
        changed(
          'card--default',
          explained(
            cause('button', { origin: '/src/button.css', selector: '.btn' }),
          ),
        ),
      ],
      [intent({ sources: ['src/button.css'] })],
    );
    expect(kindOf(results, 'card--default')).toMatchObject({
      kind: 'intended',
    });
  });

  it('treats a change as collateral when one cause is outside the declared sources', () => {
    const results = classifyResults(
      [
        changed(
          'card--default',
          explained(
            cause('button', { origin: '/src/button.css', selector: '.btn' }),
            cause('h2', { origin: '/src/card.css', selector: '.title' }),
          ),
        ),
      ],
      [intent({ sources: ['src/button.css'] })],
    );
    const classification = kindOf(results, 'card--default');
    expect(classification?.kind).toBe('collateral');
    expect(classification?.reason).toMatch(
      /change to h2 does not come from a declared source/,
    );
  });

  it('accepts a declared selector as well as a declared source', () => {
    const results = classifyResults(
      [
        changed(
          'a',
          explained(cause('button', { origin: '/x.css', selector: '.btn' })),
        ),
      ],
      [intent({ selectors: ['.btn'] })],
    );
    expect(kindOf(results, 'a')?.kind).toBe('intended');
  });

  it('does not cover a change that has no source, or no explanation', () => {
    const results = classifyResults(
      [changed('inline', explained(cause('button'))), changed('unexplained')],
      [intent({ sources: ['src/button.css'] })],
    );
    expect(kindOf(results, 'inline')?.kind).toBe('collateral');
    expect(kindOf(results, 'unexplained')?.kind).toBe('collateral');
    expect(kindOf(results, 'unexplained')?.reason).toMatch(/no explanation/);
  });

  it('does not cover pixels that nothing in the page accounts for', () => {
    const explanation = explained(
      cause('button', { origin: '/src/button.css', selector: '.btn' }),
    );
    explanation.regions.push({
      index: 1,
      box: { minX: 50, minY: 50, maxX: 60, maxY: 60 },
      causes: [],
    });
    const results = classifyResults(
      [changed('a', explanation)],
      [intent({ sources: ['src/button.css'] })],
    );
    expect(kindOf(results, 'a')?.kind).toBe('collateral');
    expect(kindOf(results, 'a')?.reason).toMatch(
      /1 changed area is not accounted for/,
    );
  });

  it('uses the first intent that covers a change', () => {
    const results = classifyResults(
      [changed('button--primary')],
      [
        intent({ id: 'one', targets: ['card'] }),
        intent({ id: 'two', targets: ['button'] }),
      ],
    );
    expect(kindOf(results, 'button--primary')?.intent).toBe('two');
  });

  it('leaves unchanged and failed snapshots alone', () => {
    const results = classifyResults(
      [
        { ...changed('a'), status: 'unchanged' },
        { ...changed('b'), status: 'failed' },
      ],
      [intent({ targets: ['zzz'] })],
    );
    expect(results.every((r) => r.classification === undefined)).toBe(true);
  });
});

describe('countClassifications', () => {
  it('counts only when something was classified', () => {
    expect(countClassifications([changed('a')])).toBeUndefined();
    const results = classifyResults(
      [changed('button--a'), changed('card--b')],
      [intent({ targets: ['button'] })],
    );
    expect(countClassifications(results)).toEqual({
      intended: 1,
      collateral: 1,
    });
  });
});

describe('decisionsNeeded', () => {
  const summary = {
    total: 4,
    passed: 0,
    changed: 3,
    added: 0,
    removed: 0,
    failed: 0,
    unchanged: 1,
  };

  it('counts every change by default', () => {
    expect(decisionsNeeded({ summary })).toBe(3);
    expect(decisionsNeeded({ summary, gate: 'any' })).toBe(3);
  });

  it('counts only collateral changes when gating on them', () => {
    expect(
      decisionsNeeded({
        summary: { ...summary, intended: 2, collateral: 1 },
        gate: 'collateral',
      }),
    ).toBe(1);
    expect(
      decisionsNeeded({
        summary: { ...summary, intended: 3, collateral: 0 },
        gate: 'collateral',
      }),
    ).toBe(0);
  });

  it('still counts every change when gating on collateral but no intent was declared', () => {
    expect(decisionsNeeded({ summary, gate: 'collateral' })).toBe(3);
  });
});

describe('intent file', () => {
  let file: string;

  beforeEach(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-intent-'));
    file = path.join(dir, 'nested', 'intent.json');
  });

  afterEach(async () => {
    await fs.rm(path.dirname(path.dirname(file)), {
      recursive: true,
      force: true,
    });
  });

  it('reads nothing when no intent was declared', async () => {
    expect(await readIntents(file)).toEqual([]);
  });

  it('adds intents with an id and author, and reads them back', async () => {
    const added = await addIntent(file, {
      description: '  Bigger button  ',
      targets: ['button', ' '],
      sources: ['src/button.css'],
      author: 'agent',
    });
    expect(added).toMatchObject({
      description: 'Bigger button',
      targets: ['button'],
      sources: ['src/button.css'],
      author: 'agent',
    });
    expect(added.id).toMatch(/^intent-[0-9a-f]{8}$/);
    await addIntent(file, { description: 'Second', selectors: ['.x'] });
    expect((await readIntents(file)).map((i) => i.description)).toEqual([
      'Bigger button',
      'Second',
    ]);
  });

  it('refuses an intent that says nothing or covers everything', async () => {
    await expect(
      addIntent(file, { description: ' ', targets: ['a'] }),
    ).rejects.toThrow(/description/);
    await expect(
      addIntent(file, { description: 'Everything' }),
    ).rejects.toThrow(/at least one of targets, sources or selectors/);
    await expect(
      addIntent(file, { description: 'Blank', targets: [' '] }),
    ).rejects.toThrow(/at least one/);
  });

  it('clears all intents or only the named ones', async () => {
    const one = await addIntent(file, { description: 'One', targets: ['a'] });
    await addIntent(file, { description: 'Two', targets: ['b'] });
    expect(await clearIntents(file, [one.id])).toBe(1);
    expect((await readIntents(file)).map((i) => i.description)).toEqual([
      'Two',
    ]);
    expect(await clearIntents(file)).toBe(1);
    expect(await readIntents(file)).toEqual([]);
  });

  it('rejects a file that is not an intent file', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{"nope":true}');
    await expect(readIntents(file)).rejects.toThrow(/not a Diffra intent file/);
    await fs.writeFile(file, 'not json');
    await expect(readIntents(file)).rejects.toThrow(/not valid JSON/);
  });
});
