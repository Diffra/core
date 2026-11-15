import { describe, expect, it } from 'vitest';
import type { LedgerElement, RenderLedger } from '../../src/context/ledger.js';
import {
  describeStyleChanges,
  explainChange,
  matchesChangedFile,
} from '../../src/pipeline/explain.js';

const BASE_STYLES = {
  'padding-top': '8px',
  'padding-right': '8px',
  'padding-bottom': '8px',
  'padding-left': '8px',
  color: 'rgb(0, 0, 0)',
};

function el(
  path: string,
  overrides: Partial<LedgerElement> & { y?: number; height?: number } = {},
): LedgerElement {
  const { y = 0, height = 20, ...rest } = overrides;
  return {
    path,
    tag: path.split('>').pop()?.split(':')[0] ?? 'div',
    box: { x: 0, y, width: 100, height },
    styles: { ...BASE_STYLES },
    rules: [],
    ...rest,
  };
}

const ledger = (...elements: LedgerElement[]): RenderLedger => ({
  schemaVersion: 1,
  viewport: { width: 400, height: 300 },
  elements,
  fonts: [],
  truncated: false,
});

const padded = (value: string) => ({
  'padding-top': value,
  'padding-right': value,
  'padding-bottom': value,
  'padding-left': value,
});

const RULE = {
  selector: '.btn',
  origin: '/src/button.css',
  declarations: padded('24px'),
};

describe('explainChange', () => {
  // A card with a button above a caption. Padding on the button pushes the
  // caption down and makes the card taller.
  const baseline = ledger(
    el('body>div', { height: 60 }),
    el('body>div>button', { id: 'go', height: 20 }),
    el('body>div>span', { y: 20, height: 20 }),
  );
  const candidate = ledger(
    el('body>div', { height: 76 }),
    el('body>div>button', {
      id: 'go',
      height: 36,
      styles: { ...BASE_STYLES, ...padded('24px') },
      rules: [RULE],
    }),
    el('body>div>span', { y: 36, height: 20 }),
  );

  it('finds the element whose style changed and the source of the change', () => {
    const { causes } = explainChange({
      baseline,
      candidate,
      regions: [],
    });
    expect(causes).toHaveLength(1);
    expect(causes[0]).toMatchObject({
      element: { tag: 'button', id: 'go' },
      source: { origin: '/src/button.css', selector: '.btn' },
      confidence: 'attributed',
    });
    expect(causes[0]?.changes.map((c) => c.property)).toEqual([
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
    ]);
  });

  it('blames elements that were pushed on the change that pushed them', () => {
    const { causes } = explainChange({ baseline, candidate, regions: [] });
    // The caption moved and the card grew, but neither changed on its own.
    expect(causes).toHaveLength(1);
    expect(causes[0]?.displaced).toBe(2);
  });

  it('maps a changed region to the cause whose elements it covers', () => {
    const { regions } = explainChange({
      baseline,
      candidate,
      regions: [{ minX: 0, minY: 30, maxX: 99, maxY: 55 }],
    });
    expect(regions[0]?.causes).toEqual([0]);
  });

  it('says which changed region nothing accounts for', () => {
    const { regions, summary } = explainChange({
      baseline,
      candidate,
      regions: [{ minX: 500, minY: 500, maxX: 530, maxY: 530 }],
    });
    expect(regions[0]?.causes).toEqual([]);
    expect(summary).toMatch(/1 changed area has no matching change/);
  });

  it('writes a plain sentence with the folded change and its source', () => {
    const { summary } = explainChange({ baseline, candidate, regions: [] });
    expect(summary).toBe(
      'button#go: padding 8px to 24px (src/button.css .btn). 2 other elements moved as a result.',
    );
  });

  it('notes when the stylesheet is one the branch changed', () => {
    const inBranch = explainChange({
      baseline,
      candidate,
      regions: [],
      changedFiles: ['src/button.css'],
    });
    expect(inBranch.causes[0]?.source?.inBranch).toBe(true);
    expect(inBranch.summary).toMatch(/changed in this branch/);

    const notInBranch = explainChange({
      baseline,
      candidate,
      regions: [],
      changedFiles: ['src/other.css'],
    });
    expect(notInBranch.causes[0]?.source?.inBranch).toBe(false);
  });

  it('does not blame a layout change for a colour change', () => {
    const recolored = ledger(
      el('body>div', { height: 60 }),
      el('body>div>button', {
        height: 20,
        styles: { ...BASE_STYLES, color: 'rgb(255, 0, 0)' },
      }),
      el('body>div>span', { y: 20, height: 20 }),
    );
    const { causes } = explainChange({
      baseline,
      candidate: recolored,
      regions: [],
    });
    expect(causes).toHaveLength(1);
    expect(causes[0]?.displaced).toBe(0);
    expect(causes[0]?.changes).toEqual([
      { property: 'color', before: 'rgb(0, 0, 0)', after: 'rgb(255, 0, 0)' },
    ]);
  });

  it('reports changed text', () => {
    const { causes, summary } = explainChange({
      baseline: ledger(el('body>p', { text: 'Save' })),
      candidate: ledger(el('body>p', { text: 'Save changes' })),
      regions: [],
    });
    expect(causes[0]?.textChange).toEqual({
      before: 'Save',
      after: 'Save changes',
    });
    expect(summary).toMatch(/text changed from "Save" to "Save changes"/);
  });

  it('reports elements that appeared and disappeared', () => {
    const { causes } = explainChange({
      baseline: ledger(el('body>a')),
      candidate: ledger(el('body>b')),
      regions: [],
    });
    expect(
      causes.map((c) => [c.element.tag, c.appeared, c.disappeared]),
    ).toEqual([
      ['b', true, undefined],
      ['a', undefined, true],
    ]);
  });

  it('keeps an element that moved for no visible reason as its own cause', () => {
    const { causes } = explainChange({
      baseline: ledger(el('body>p', { y: 0 })),
      candidate: ledger(el('body>p', { y: 40 })),
      regions: [],
    });
    expect(causes).toHaveLength(1);
    expect(causes[0]).toMatchObject({ changes: [], displaced: 0 });
  });

  it('says so when nothing in the page changed', () => {
    const { causes, summary } = explainChange({
      baseline: ledger(el('body>p')),
      candidate: ledger(el('body>p')),
      regions: [{ minX: 0, minY: 0, maxX: 10, maxY: 10 }],
    });
    expect(causes).toEqual([]);
    expect(summary).toMatch(/^No change in the page accounts for/);
    expect(summary).toMatch(/image, a canvas or a rendering difference/);
  });
});

describe('describeStyleChanges', () => {
  it('folds four equal sides into one and keeps differing sides apart', () => {
    expect(
      describeStyleChanges([
        { property: 'padding-top', before: '8px', after: '16px' },
        { property: 'padding-right', before: '8px', after: '16px' },
        { property: 'padding-bottom', before: '8px', after: '16px' },
        { property: 'padding-left', before: '8px', after: '16px' },
        { property: 'color', before: 'red', after: 'blue' },
      ]),
    ).toBe('padding 8px to 16px, color red to blue');

    expect(
      describeStyleChanges([
        { property: 'margin-top', before: '0px', after: '8px' },
        { property: 'margin-left', before: '0px', after: '4px' },
      ]),
    ).toBe('margin-top 0px to 8px, margin-left 0px to 4px');
  });
});

describe('matchesChangedFile', () => {
  it('matches a stylesheet origin against project-relative paths', () => {
    expect(matchesChangedFile('/src/a.css', ['src/a.css'])).toBe(true);
    expect(matchesChangedFile('/src/a.css?t=123', ['src/a.css'])).toBe(true);
    expect(matchesChangedFile('/assets/a.css', ['web/assets/a.css'])).toBe(
      true,
    );
    expect(matchesChangedFile('/src/a.css', ['src/b.css'])).toBe(false);
    expect(matchesChangedFile('/src/a.css', ['lib/xa.css'])).toBe(false);
    expect(matchesChangedFile('inline', ['src/a.css'])).toBe(false);
  });
});

describe('explainChange and sizes', () => {
  const grown = (height: number) =>
    ledger(
      el('html', {
        height: height + 10,
        styles: { ...BASE_STYLES, height: `${height + 10}px` },
      }),
      el('html>body>button', {
        id: 'go',
        height,
        styles: { ...BASE_STYLES, height: `${height}px` },
      }),
    );

  it('treats a size that no rule sets as an effect, not a cause', () => {
    const { causes } = explainChange({
      baseline: grown(20),
      candidate: ledger(
        el('html', { height: 50, styles: { ...BASE_STYLES, height: '50px' } }),
        el('html>body>button', {
          id: 'go',
          height: 40,
          styles: { ...BASE_STYLES, height: '40px', 'padding-top': '16px' },
        }),
      ),
      regions: [],
    });
    expect(causes).toHaveLength(1);
    expect(causes[0]?.element.tag).toBe('button');
    expect(causes[0]?.changes.map((c) => c.property)).toEqual(['padding-top']);
    expect(causes[0]?.displaced).toBe(1);
  });

  it('counts a size change as a cause when a rule sets it', () => {
    const sized = (width: string) =>
      ledger(
        el('body>div', {
          styles: { ...BASE_STYLES, width },
          rules: [
            { selector: '.box', origin: '/a.css', declarations: { width } },
          ],
        }),
      );
    const { causes } = explainChange({
      baseline: sized('100px'),
      candidate: sized('200px'),
      regions: [],
    });
    expect(causes[0]?.changes).toEqual([
      { property: 'width', before: '100px', after: '200px' },
    ]);
  });
});
