import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AFFECTED_FILTER,
  approveBaselines,
  type DiffraConfig,
  runVisualRegression,
} from '../../src/index.js';
import { selectAffected } from '../../src/pipeline/affected.js';
import { verifyRun } from '../../src/pipeline/verify.js';

const exec = promisify(execFile);

const BASE_BRANCH = 'main';
const VIEWPORT = { width: 320, height: 200 };
const HOME_ID = 'route--home';
const OTHER_ID = 'route--other';
const HOME_STYLESHEET = 'src/card.css';
const OTHER_STYLESHEET = 'src/other.css';
const UNRELATED_FILE = 'src/app.ts';

const cardCss = (padding: number) =>
  `.btn {\n  padding: ${padding}px;\n  background: rgb(30, 90, 200);\n  color: white;\n  border: 0;\n  font: 16px sans-serif;\n}\n`;

const otherCss = `.tag {\n  padding: 4px;\n  background: rgb(200, 90, 30);\n  color: white;\n  font: 16px sans-serif;\n}\n`;

describe('affected selection and verification against real pages', () => {
  let dir: string;
  let server: http.Server;
  let baseUrl: string;

  const git = (...args: string[]) => exec('git', args, { cwd: dir });
  const write = (file: string, text: string) =>
    fs.writeFile(path.join(dir, file), text);

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-affected-'));
    await fs.mkdir(path.join(dir, 'src'));
    await write(HOME_STYLESHEET, cardCss(16));
    await write(OTHER_STYLESHEET, otherCss);
    await write(UNRELATED_FILE, 'export const answer = 42;\n');
    await write('.gitignore', '.diffra/\n');
    await git('init', '-b', BASE_BRANCH);
    await git('config', 'user.email', 'test@example.com');
    await git('config', 'user.name', 'Test');
    await git('config', 'commit.gpgsign', 'false');
    await git('add', '.');
    await git('commit', '-m', 'initial');

    server = http.createServer(async (req, res) => {
      const url = req.url ?? '/';
      if (url.startsWith('/src/') && url.endsWith('.css')) {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(await fs.readFile(path.join(dir, url)));
        return;
      }
      const [stylesheet, markup] =
        url === '/other'
          ? ['/src/other.css', '<span class="tag">Tag</span>']
          : ['/src/card.css', '<button class="btn" id="go">Save</button>'];
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        `<!doctype html><link rel="stylesheet" href="${stylesheet}"><body style="margin:0">${markup}`,
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
    drivers: { driver: 'url', baseUrl, urls: ['/', '/other'] },
    storage: { provider: 'local', outputDir: path.join(dir, '.diffra') },
    snapshot: { viewports: [VIEWPORT], delay: 0 },
    runner: { baselineBranch: BASE_BRANCH },
  });

  /** A run whose results are all approved as baselines. */
  async function approvedRun() {
    const first = await runVisualRegression({ cwd: dir, config: config() });
    expect(first.results.map((r) => r.id).sort()).toEqual([HOME_ID, OTHER_ID]);
    await approveBaselines({ cwd: dir, config: config(), report: first });
    return first;
  }

  const editCard = (padding: number) =>
    write(HOME_STYLESHEET, cardCss(padding));

  it('selects only the snapshot that a changed stylesheet styles', async () => {
    await approvedRun();
    await editCard(32);

    const selection = await selectAffected({ cwd: dir, config: config() });
    expect(selection.basis).toBe('ledgers');
    expect(selection.ids).toEqual([HOME_ID]);
    expect(selection.changedFiles).toEqual([HOME_STYLESHEET]);
    expect(selection.matchedFiles).toEqual([HOME_STYLESHEET]);
    expect(selection.unmatchedFiles).toEqual([]);
  });

  it('reports a changed file that no snapshot uses as unmatched', async () => {
    await approvedRun();
    await editCard(32);
    await write(UNRELATED_FILE, 'export const answer = 43;\n');

    const selection = await selectAffected({ cwd: dir, config: config() });
    expect(selection.basis).toBe('ledgers');
    expect(selection.ids).toEqual([HOME_ID]);
    expect(selection.matchedFiles).toEqual([HOME_STYLESHEET]);
    expect(selection.unmatchedFiles).toEqual([UNRELATED_FILE]);
    expect(selection.note).toContain('1 changed file is not known');
  });

  it('knows nothing before a first run', async () => {
    await editCard(32);

    const selection = await selectAffected({ cwd: dir, config: config() });
    expect(selection.basis).toBe('none');
    expect(selection.ids).toEqual([]);
    expect(selection.unmatchedFiles).toEqual([HOME_STYLESHEET]);
  });

  it('indexes snapshots that were unchanged in the last run', async () => {
    await approvedRun();
    const second = await runVisualRegression({ cwd: dir, config: config() });
    expect(second.results.every((r) => r.status === 'unchanged')).toBe(true);
    await editCard(32);

    const selection = await selectAffected({ cwd: dir, config: config() });
    expect(selection.basis).toBe('ledgers');
    expect(selection.ids).toEqual([HOME_ID]);
  });

  it('runs only the affected snapshot, then shows the change resolved once it is reverted', async () => {
    await approvedRun();
    await editCard(32);

    const changed = await verifyRun({
      cwd: dir,
      config: config(),
      affected: true,
    });
    expect(changed.affected?.ran).toBe('affected');
    expect(changed.report.filter).toBe(AFFECTED_FILTER);
    expect(changed.report.results).toHaveLength(1);
    expect(changed.report.results[0]?.id).toBe(HOME_ID);
    expect(changed.report.results[0]?.status).toBe('changed');
    expect(changed.verification.newlyChanged.map((r) => r.id)).toEqual([
      HOME_ID,
    ]);

    await editCard(16);
    const reverted = await verifyRun({
      cwd: dir,
      config: config(),
      affected: true,
    });
    expect(reverted.verification.resolved.map((r) => r.id)).toEqual([HOME_ID]);
    expect(reverted.verification.stillChanged).toEqual([]);
    expect(reverted.report.results.every((r) => r.status === 'unchanged')).toBe(
      true,
    );
  });

  it('keeps selecting after a partial run replaced the latest report', async () => {
    await approvedRun();
    await editCard(32);
    await verifyRun({ cwd: dir, config: config(), affected: true });

    // The latest report now holds only the affected snapshot, but the edit to
    // the stylesheet is still open and still reaches it.
    const selection = await selectAffected({ cwd: dir, config: config() });
    expect(selection.basis).toBe('ledgers');
    expect(selection.ids).toEqual([HOME_ID]);
  });

  it('still knows the snapshots a partial run skipped', async () => {
    await approvedRun();
    await editCard(32);
    await verifyRun({ cwd: dir, config: config(), affected: true });
    await write(OTHER_STYLESHEET, otherCss.replace('4px', '12px'));

    const selection = await selectAffected({ cwd: dir, config: config() });
    expect(selection.ids.sort()).toEqual([HOME_ID, OTHER_ID]);
    expect(selection.unmatchedFiles).toEqual([]);
  });

  it('falls back to a full run when no changed file is known to reach a snapshot', async () => {
    await approvedRun();
    await write(UNRELATED_FILE, 'export const answer = 43;\n');

    const result = await verifyRun({
      cwd: dir,
      config: config(),
      affected: true,
    });
    expect(result.affected?.ran).toBe('everything');
    expect(result.affected?.ids).toEqual([]);
    expect(result.report.filter).toBeUndefined();
    expect(result.report.results).toHaveLength(2);
  });

  it('does not report the snapshots it skipped as removed', async () => {
    await approvedRun();
    await editCard(32);

    const partial = await runVisualRegression({
      cwd: dir,
      config: config(),
      only: [HOME_ID],
    });
    expect(partial.filter).toBe(AFFECTED_FILTER);
    expect(partial.results.map((r) => r.id)).toEqual([HOME_ID]);
    expect(partial.summary.removed).toBe(0);
    expect(partial.results.some((r) => r.status === 'removed')).toBe(false);
  });
});
