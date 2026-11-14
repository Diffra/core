import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { branchUrl, commitUrl, shortCommit } from '../src/lib/links.js';
import { stepIndex } from '../src/lib/navigation.js';
import {
  availableFilters,
  buildReviewList,
  countByStatus,
  describeRun,
  flattenGroups,
} from '../src/lib/review-list.js';
import { buildRoute, parseRoute } from '../src/lib/route.js';
import { needsReview } from '../src/lib/status.js';
import type { TestResult, TestStatus } from '../src/types/index.js';

function result(
  name: string,
  status: TestStatus,
  component = 'Button',
  viewport = 'desktop',
): TestResult {
  return {
    id: `${component}--${name}--${viewport}`,
    name,
    component,
    status,
    diffPercentage: 0,
    diffCount: 0,
    viewport: { name: viewport, width: 1280, height: 800 },
  };
}

const sample: TestResult[] = [
  result('Primary', 'unchanged'),
  result('Secondary', 'changed'),
  result('Disabled', 'added'),
  result('Header', 'failed', 'Card'),
  result('Footer', 'unchanged', 'Card'),
  result('Body', 'changed', 'Card'),
];

describe('route', () => {
  const hasSnapshot = (id: string) => id === 'button--primary';

  it('opens the overview for an empty location', () => {
    expect(parseRoute('', hasSnapshot)).toEqual({ kind: 'overview' });
    expect(parseRoute('/', hasSnapshot)).toEqual({ kind: 'overview' });
  });

  it('reads the snapshot and the mode from a link', () => {
    expect(parseRoute('/story/button--primary/split', hasSnapshot)).toEqual({
      kind: 'snapshot',
      id: 'button--primary',
      mode: 'split',
    });
  });

  it('falls back to the diff mode when the mode is missing or unknown', () => {
    const expected = { kind: 'snapshot', id: 'a', mode: 'diff' };
    expect(parseRoute('/story/a', hasSnapshot)).toEqual(expected);
    expect(parseRoute('/story/a/heatmap', hasSnapshot)).toEqual(expected);
  });

  it('accepts a bare snapshot id only when it exists', () => {
    expect(parseRoute('/button--primary', hasSnapshot)).toMatchObject({
      kind: 'snapshot',
      id: 'button--primary',
    });
    expect(parseRoute('/nothing', hasSnapshot)).toEqual({ kind: 'overview' });
  });

  it('survives malformed percent encoding', () => {
    expect(parseRoute('/story/%E0%A4%A/diff', hasSnapshot)).toMatchObject({
      kind: 'snapshot',
    });
  });

  it('round-trips ids that contain slashes', () => {
    const route = {
      kind: 'snapshot',
      id: 'ui/button primary',
      mode: 'fade',
    } as const;
    expect(parseRoute(buildRoute(route), () => false)).toEqual(route);
  });
});

describe('review list', () => {
  const names = (filter: Parameters<typeof buildReviewList>[1]['filter']) =>
    flattenGroups(buildReviewList(sample, { query: '', filter })).map(
      (r) => r.name,
    );

  it('shows only what needs review by default', () => {
    const shown = flattenGroups(
      buildReviewList(sample, { query: '', filter: 'review' }),
    );
    expect(shown.map((r) => r.status)).not.toContain('unchanged');
    expect(shown).toHaveLength(4);
  });

  it('filters to a single status', () => {
    expect(names('unchanged')).toEqual(['Primary', 'Footer']);
    expect(names('failed')).toEqual(['Header']);
    expect(names('removed')).toEqual([]);
  });

  it('puts the most urgent component and snapshot first', () => {
    const groups = buildReviewList(sample, { query: '', filter: 'review' });
    // Card has a failed snapshot, Button only changed and added ones.
    expect(groups.map((g) => g.component)).toEqual(['Card', 'Button']);
    expect(groups[0]?.items.map((r) => r.status)).toEqual([
      'failed',
      'changed',
    ]);
    expect(groups[1]?.items.map((r) => r.status)).toEqual(['changed', 'added']);
  });

  it('filters by snapshot or component name, ignoring case', () => {
    const byName = flattenGroups(
      buildReviewList(sample, { query: ' SECOND', filter: 'review' }),
    );
    expect(byName.map((r) => r.name)).toEqual(['Secondary']);
    const byComponent = flattenGroups(
      buildReviewList(sample, { query: 'card', filter: 'review' }),
    );
    expect(byComponent.map((r) => r.name)).toEqual(['Header', 'Body']);
  });

  it('offers only the filters that exist in the run', () => {
    expect(availableFilters(sample)).toEqual([
      'review',
      'failed',
      'changed',
      'added',
      'unchanged',
    ]);
    expect(availableFilters([])).toEqual(['review']);
  });

  it('describes the run in words', () => {
    expect(describeRun(sample)).toBe('1 failed, 2 changed, 1 new');
    expect(describeRun([result('A', 'unchanged')])).toBe('No visual changes');
    expect(describeRun([])).toBe('No visual changes');
  });

  it('counts every status', () => {
    expect(countByStatus(sample)).toEqual({
      failed: 1,
      changed: 2,
      removed: 0,
      added: 1,
      unchanged: 2,
    });
    expect(needsReview('unchanged')).toBe(false);
    expect(needsReview('failed')).toBe(true);
  });
});

describe('stepIndex', () => {
  it('wraps around both ends', () => {
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
  });

  it('starts at either end when nothing is selected', () => {
    expect(stepIndex(null, 3, 1)).toBe(0);
    expect(stepIndex(null, 3, -1)).toBe(2);
    expect(stepIndex(-1, 3, 1)).toBe(0);
  });

  it('returns nothing for an empty list', () => {
    expect(stepIndex(null, 0, 1)).toBeNull();
  });
});

describe('links', () => {
  it('links nothing when the report names no repository', () => {
    expect(branchUrl(undefined, 'main')).toBeUndefined();
    expect(commitUrl(undefined, 'abc1234')).toBeUndefined();
  });

  it('builds branch and commit links without double slashes', () => {
    expect(branchUrl('https://github.com/acme/app/', 'feat/x')).toBe(
      'https://github.com/acme/app/tree/feat/x',
    );
    expect(commitUrl('https://github.com/acme/app', 'abc1234')).toBe(
      'https://github.com/acme/app/commit/abc1234',
    );
  });

  it('ignores commits that do not exist yet', () => {
    expect(
      commitUrl('https://github.com/acme/app', 'uncommitted'),
    ).toBeUndefined();
    expect(shortCommit('uncommitted')).toBeUndefined();
    expect(shortCommit('0123456789abcdef')).toBe('0123456');
  });
});

describe('Feature 22: Custom Element <diffra-viewer> Registration & Web Component Contract', () => {
  it('implements DiffraViewer custom element with Shadow DOM and lifecycle methods in index.tsx', async () => {
    const indexPath = path.resolve(import.meta.dirname, '../src/index.tsx');
    const content = await fs.readFile(indexPath, 'utf-8');

    expect(content).toContain('class DiffraViewer extends');
    expect(content).toContain("attachShadow({ mode: 'open' })");
    expect(content).toMatch(/customElements\.define\(\s*['"]diffra-viewer['"]/);
    expect(content).toContain('connectedCallback(): void');
    expect(content).toContain('disconnectedCallback(): void');
    expect(content).toContain('attributeChangedCallback(');
  });

  it('defines observedAttributes for report URLs and inline report data', async () => {
    const indexPath = path.resolve(import.meta.dirname, '../src/index.tsx');
    const content = await fs.readFile(indexPath, 'utf-8');

    expect(content).toContain('static get observedAttributes()');
    expect(content).toContain("'report-url'");
    expect(content).toContain("'data-report-url'");
    expect(content).toContain("'report-data'");
    expect(content).toContain("'data-report'");
  });

  it('exposes reportUrl, reportData, and manifest element getters and setters', async () => {
    const indexPath = path.resolve(import.meta.dirname, '../src/index.tsx');
    const content = await fs.readFile(indexPath, 'utf-8');

    expect(content).toContain('get reportUrl(): string | undefined');
    expect(content).toContain('set reportUrl(');
    expect(content).toContain('get reportData(): TestRunReport | undefined');
    expect(content).toContain('set reportData(');
    expect(content).toContain('get manifest(): TestRunReport | undefined');
    expect(content).toContain('set manifest(');
  });

  it('retains initDiffraViewer for backwards compatibility', async () => {
    const indexPath = path.resolve(import.meta.dirname, '../src/index.tsx');
    const content = await fs.readFile(indexPath, 'utf-8');

    expect(content).toContain('export function initDiffraViewer(');
  });

  it('correctly maps ./style.css export to ./dist/viewer.css in package.json', async () => {
    const pkgPath = path.resolve(import.meta.dirname, '../package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    expect(pkg.exports).toBeDefined();
    expect(pkg.exports['./style.css']).toBe('./dist/viewer.css');
    expect(pkg.exports['./bundle']).toBe('./dist/viewer.bundle.js');
  });
});

describe('Interface standards', () => {
  async function sourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...(await sourceFiles(full)));
      else if (/\.(tsx|ts|css)$/.test(entry.name)) files.push(full);
    }
    return files;
  }

  async function violations(pattern: RegExp, subdir = ''): Promise<string[]> {
    const srcDir = path.resolve(import.meta.dirname, '../src');
    const found: string[] = [];
    for (const file of await sourceFiles(path.join(srcDir, subdir))) {
      const lines = (await fs.readFile(file, 'utf-8')).split('\n');
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          found.push(`${path.relative(srcDir, file)}:${index + 1}`);
        }
      });
    }
    return found;
  }

  it('uses no drop shadows', async () => {
    expect(await violations(/\bshadow-(?:xs|sm|md|lg|xl|2xl|inner)\b/)).toEqual(
      [],
    );
  });

  it('uses no text smaller than 1rem', async () => {
    expect(await violations(/\btext-(?:xs|sm|\[\d+px\])\b/)).toEqual([]);
  });

  it('uses no uppercase styling', async () => {
    expect(await violations(/\buppercase\b/)).toEqual([]);
  });

  it('renders no diff percentages or pixel counts in components', async () => {
    expect(
      await violations(/\b(?:diffPercentage|diffCount)\b/, 'components'),
    ).toEqual([]);
  });

  it('avoids the word legacy in code and comments', async () => {
    expect(await violations(/legacy/i)).toEqual([]);
  });
});
