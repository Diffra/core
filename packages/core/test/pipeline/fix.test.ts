import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  approveBaselines,
  type DiffraConfig,
  proveSnapshot,
  restoreInStylesheet,
  runVisualRegression,
  suggestFixes,
  unifiedDiff,
} from '../../src/index.js';
import type {
  Explanation,
  PropertyChange,
} from '../../src/pipeline/explain.js';

const exec = promisify(execFile);

const sides = (before: string, after: string): PropertyChange[] =>
  ['top', 'right', 'bottom', 'left'].map((side) => ({
    property: `padding-${side}`,
    before,
    after,
  }));

const CSS = `/* buttons */
.card { margin: 0; }

.btn, .link {
  color: white;
  padding: 32px;
}
`;

describe('restoreInStylesheet', () => {
  it('puts a shorthand back when all four sides changed alike', () => {
    const restored = restoreInStylesheet(
      CSS,
      '.btn, .link',
      sides('16px', '32px'),
    );
    expect(restored).toEqual({
      text: CSS.replace('padding: 32px', 'padding: 16px'),
    });
  });

  it('puts back a single property', () => {
    const restored = restoreInStylesheet(CSS, '.btn, .link', [
      { property: 'color', before: 'red', after: 'white' },
    ]);
    expect(restored).toEqual({
      text: CSS.replace('color: white', 'color: red'),
    });
  });

  it('keeps !important and matches the selector however it is spaced', () => {
    const css = '.a,.b{padding:8px !important}';
    expect(restoreInStylesheet(css, '.a, .b', sides('4px', '8px'))).toEqual({
      text: '.a,.b{padding:4px !important}',
    });
  });

  it('finds a rule inside a media query', () => {
    const css =
      '@media (min-width: 600px) {\n  .btn {\n    padding: 32px;\n  }\n}\n';
    expect(restoreInStylesheet(css, '.btn', sides('16px', '32px'))).toEqual({
      text: css.replace('32px', '16px'),
    });
  });

  it('does not guess when the value is not written as the browser computed it', () => {
    const css = '.btn { padding: 2rem; }';
    expect(restoreInStylesheet(css, '.btn', sides('16px', '32px'))).toEqual({
      missing: [
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
      ],
    });
  });

  it('does not patch part of what has to be restored', () => {
    const result = restoreInStylesheet(CSS, '.btn, .link', [
      ...sides('16px', '32px'),
      { property: 'color', before: 'red', after: 'rgb(255, 255, 255)' },
    ]);
    expect(result).toEqual({ missing: ['color'] });
  });

  it('does not find a rule that is not there, or one in a comment', () => {
    expect(
      restoreInStylesheet(CSS, '.missing', sides('1px', '2px')),
    ).toMatchObject({
      missing: expect.any(Array),
    });
    const commented = '/* .btn { padding: 32px; } */';
    expect(
      restoreInStylesheet(commented, '.btn', sides('16px', '32px')),
    ).toMatchObject({
      missing: expect.any(Array),
    });
  });
});

describe('unifiedDiff', () => {
  it('writes a diff that git can apply', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-patch-'));
    try {
      const after = CSS.replace('padding: 32px', 'padding: 16px');
      const patch = unifiedDiff('src/card.css', CSS, after);
      expect(patch).toContain('--- a/src/card.css\n+++ b/src/card.css\n');
      expect(patch).toContain('-  padding: 32px;\n+  padding: 16px;\n');

      await fs.mkdir(path.join(dir, 'src'));
      await fs.writeFile(path.join(dir, 'src/card.css'), CSS);
      await fs.writeFile(path.join(dir, 'fix.patch'), patch);
      await exec('git', ['apply', '--check', 'fix.patch'], { cwd: dir });
      await exec('git', ['apply', 'fix.patch'], { cwd: dir });
      expect(await fs.readFile(path.join(dir, 'src/card.css'), 'utf-8')).toBe(
        after,
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('marks a file that does not end with a line break', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-patch-eof-'));
    try {
      const before = '.a {\n  padding: 32px;\n}';
      const after = before.replace('32px', '16px');
      await fs.writeFile(path.join(dir, 'a.css'), before);
      await fs.writeFile(
        path.join(dir, 'fix.patch'),
        unifiedDiff('a.css', before, after),
      );
      await exec('git', ['apply', 'fix.patch'], { cwd: dir });
      expect(await fs.readFile(path.join(dir, 'a.css'), 'utf-8')).toBe(after);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('joins nearby changes and splits distant ones', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i}`);
    const changed = [...lines];
    changed[2] = 'near a';
    changed[4] = 'near b';
    changed[25] = 'far';
    const diff = unifiedDiff('f', lines.join('\n'), changed.join('\n'));
    expect(diff.match(/^@@/gm)).toHaveLength(2);
  });

  it('writes nothing when nothing changed', () => {
    expect(unifiedDiff('f', 'a\nb', 'a\nb')).toBe('');
  });
});

describe('suggestFixes', () => {
  const explanation = (proof: Explanation['proof']): Explanation => ({
    summary: '',
    causes: [
      {
        element: { path: 'html>body>button', tag: 'button', id: 'go' },
        changes: sides('16px', '32px'),
        source: { origin: '/src/card.css', selector: '.btn, .link' },
        displaced: 0,
        confidence: 'proven',
      },
    ],
    regions: [],
    ...(proof ? { proof } : {}),
  });

  it('suggests nothing until the cause is proven', async () => {
    const result = await suggestFixes({
      explanation: explanation(undefined),
      cwd: '/nowhere',
    });
    expect(result.suggestions).toEqual([]);
    expect(result.note).toMatch(/not proven/);
  });

  it('says what to restore when the stylesheet is not in the project', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-nofile-'));
    try {
      const result = await suggestFixes({
        explanation: explanation({ status: 'proven', reverted: 1, note: '' }),
        cwd: dir,
      });
      const [suggestion] = result.suggestions;
      expect(suggestion?.patch).toBeUndefined();
      expect(suggestion?.note).toMatch(/not in the project/);
      expect(suggestion?.restore).toHaveLength(4);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe('the fix loop', () => {
  let dir: string;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-fixloop-'));
    await fs.mkdir(path.join(dir, 'src'));
    await fs.writeFile(
      path.join(dir, 'src/card.css'),
      '.btn {\n  padding: 16px;\n  background: rgb(30, 90, 200);\n  color: white;\n  border: 0;\n  font: 16px sans-serif;\n}\n',
    );
    server = http.createServer(async (req, res) => {
      if (req.url === '/src/card.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(await fs.readFile(path.join(dir, 'src/card.css')));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<!doctype html><link rel="stylesheet" href="/src/card.css"><body style="margin:0"><button class="btn" id="go">Save</button>',
      );
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(dir, { recursive: true, force: true });
  });

  const config = (): Partial<DiffraConfig> => ({
    drivers: { driver: 'url', baseUrl, urls: ['/'] },
    storage: { provider: 'local', outputDir: path.join(dir, '.diffra') },
    snapshot: { viewports: [{ width: 320, height: 200 }], delay: 0 },
  });

  it('turns a proven change into a patch that makes the next run clean', async () => {
    const first = await runVisualRegression({ cwd: dir, config: config() });
    await approveBaselines({ cwd: dir, config: config(), report: first });

    const css = path.join(dir, 'src/card.css');
    await fs.writeFile(
      css,
      (await fs.readFile(css, 'utf-8')).replace('16px;', '32px;'),
    );
    const changed = await runVisualRegression({ cwd: dir, config: config() });
    expect(changed.results[0]?.status).toBe('changed');

    const { explanation } = await proveSnapshot({
      cwd: dir,
      config: config(),
      id: 'route--home',
    });
    const { suggestions } = await suggestFixes({ explanation, cwd: dir });
    const [suggestion] = suggestions;
    expect(suggestion).toMatchObject({
      file: 'src/card.css',
      selector: '.btn',
    });
    expect(suggestion?.patch).toContain('+  padding: 16px;');

    await fs.writeFile(path.join(dir, 'fix.patch'), suggestion?.patch ?? '');
    await exec('git', ['apply', 'fix.patch'], { cwd: dir });

    const after = await runVisualRegression({ cwd: dir, config: config() });
    expect(after.results[0]?.status).toBe('unchanged');
  });
});
