import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RenderLedger } from '../../src/context/ledger.js';
import {
  addIntent,
  approveBaselines,
  type DiffraConfig,
  decisionsNeeded,
  runVisualRegression,
  type TestRunReport,
} from '../../src/index.js';

const VIEWPORT = { width: 320, height: 200 };

/** A page whose button padding comes from a named stylesheet. */
const page = (padding: number) => `<!doctype html><html><head>
<style data-vite-dev-id="/src/card.css">.btn { padding: ${padding}px; background: rgb(30, 90, 200); color: white; }</style>
</head><body style="margin:0"><button class="btn" id="go">Save</button></body></html>`;

describe('render ledgers in a run', () => {
  let dir: string;
  let server: http.Server;
  let baseUrl: string;
  let padding: number;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-ledger-'));
    padding = 16;
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(page(padding));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(dir, { recursive: true, force: true });
  });

  const config = (
    extra: Partial<DiffraConfig> = {},
  ): Partial<DiffraConfig> => ({
    drivers: { driver: 'url', baseUrl, urls: ['/'] },
    storage: { provider: 'local', outputDir: path.join(dir, '.diffra') },
    snapshot: { viewports: [VIEWPORT], delay: 0 },
    ...extra,
  });

  async function ledgerOf(
    report: TestRunReport & { reviewDir: string },
    which: 'baseline' | 'candidate',
  ): Promise<RenderLedger> {
    const url = report.results[0]?.ledgers?.[which];
    expect(url).toMatch(/^ledgers\/[0-9a-f]{64}\.json$/);
    return JSON.parse(
      await fs.readFile(path.join(report.reviewDir, url ?? ''), 'utf-8'),
    );
  }

  const button = (ledger: RenderLedger) =>
    ledger.elements.find((e) => e.id === 'go');

  it('records the candidate ledger of a new snapshot in the bundle', async () => {
    const report = await runVisualRegression({ cwd: dir, config: config() });
    expect(report.results[0]?.status).toBe('added');
    expect(report.results[0]?.ledgers?.baseline).toBeUndefined();
    const ledger = await ledgerOf(report, 'candidate');
    expect(button(ledger)?.styles['padding-left']).toBe('16px');
  });

  it('gives a changed snapshot the ledger of its baseline as well', async () => {
    const first = await runVisualRegression({ cwd: dir, config: config() });
    await approveBaselines({ cwd: dir, config: config(), report: first });

    padding = 32;
    const second = await runVisualRegression({ cwd: dir, config: config() });
    expect(second.results[0]?.status).toBe('changed');

    const baseline = button(await ledgerOf(second, 'baseline'));
    const candidate = button(await ledgerOf(second, 'candidate'));
    expect(baseline?.styles['padding-left']).toBe('16px');
    expect(candidate?.styles['padding-left']).toBe('32px');
    expect(candidate?.rules[0]).toMatchObject({
      selector: '.btn',
      origin: '/src/card.css',
    });
  });

  it('records nothing when agent context is turned off', async () => {
    const report = await runVisualRegression({
      cwd: dir,
      config: config({ agent: { context: false } }),
    });
    expect(report.results[0]?.ledgers).toBeUndefined();
  });
});

describe('explanations in a run', () => {
  let dir: string;
  let server: http.Server;
  let baseUrl: string;
  let padding: number;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-explain-'));
    padding = 16;
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(page(padding));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('says which change in the page caused a changed snapshot', async () => {
    const config: Partial<DiffraConfig> = {
      drivers: { driver: 'url', baseUrl, urls: ['/'] },
      storage: { provider: 'local', outputDir: path.join(dir, '.diffra') },
      snapshot: { viewports: [VIEWPORT], delay: 0 },
    };
    const first = await runVisualRegression({ cwd: dir, config });
    expect(first.results[0]?.explanation).toBeUndefined();
    await approveBaselines({ cwd: dir, config, report: first });

    padding = 32;
    const second = await runVisualRegression({ cwd: dir, config });
    const explanation = second.results[0]?.explanation;
    expect(explanation?.causes).toHaveLength(1);
    expect(explanation?.causes[0]).toMatchObject({
      element: { tag: 'button', id: 'go' },
      source: { origin: '/src/card.css', selector: '.btn' },
      confidence: 'attributed',
    });
    expect(explanation?.summary).toMatch(
      /^button#go: padding 16px to 32px \(src\/card\.css \.btn\)/,
    );
    // The changed pixels are accounted for, not left unexplained.
    expect(explanation?.regions.length).toBeGreaterThan(0);
    expect(explanation?.regions.every((r) => r.causes.length > 0)).toBe(true);
  });
});

describe('intents in a run', () => {
  let dir: string;
  let server: http.Server;
  let baseUrl: string;
  let padding: number;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-intent-run-'));
    padding = 16;
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(page(padding));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(dir, { recursive: true, force: true });
  });

  const config = (
    extra: Partial<DiffraConfig> = {},
  ): Partial<DiffraConfig> => ({
    drivers: { driver: 'url', baseUrl, urls: ['/'] },
    storage: { provider: 'local', outputDir: path.join(dir, '.diffra') },
    snapshot: { viewports: [VIEWPORT], delay: 0 },
    ...extra,
  });

  async function changedRun(extra: Partial<DiffraConfig> = {}) {
    const first = await runVisualRegression({ cwd: dir, config: config() });
    await approveBaselines({ cwd: dir, config: config(), report: first });
    padding = 32;
    return runVisualRegression({ cwd: dir, config: config(extra) });
  }

  it('does not classify anything when no intent was declared', async () => {
    const report = await changedRun();
    expect(report.results[0]?.classification).toBeUndefined();
    expect(report.summary.collateral).toBeUndefined();
    expect(report.intents).toBeUndefined();
  });

  it('calls a change intended when it comes from a declared source', async () => {
    const intentFile = path.join(dir, '.diffra', 'intent.json');
    await addIntent(intentFile, {
      description: 'Roomier buttons',
      sources: ['src/card.css'],
      author: 'agent',
    });
    const report = await changedRun({ agent: { gate: 'collateral' } });
    expect(report.results[0]?.classification).toMatchObject({
      kind: 'intended',
    });
    expect(report.summary).toMatchObject({
      changed: 1,
      intended: 1,
      collateral: 0,
    });
    expect(report.intents).toHaveLength(1);
    expect(decisionsNeeded(report)).toBe(0);
  });

  it('calls a change collateral when it comes from somewhere else', async () => {
    const intentFile = path.join(dir, '.diffra', 'intent.json');
    await addIntent(intentFile, {
      description: 'Restyle the header',
      sources: ['src/header.css'],
    });
    const report = await changedRun({ agent: { gate: 'collateral' } });
    expect(report.results[0]?.classification).toMatchObject({
      kind: 'collateral',
    });
    expect(report.summary).toMatchObject({ intended: 0, collateral: 1 });
    expect(decisionsNeeded(report)).toBe(1);
  });

  it('reads intents from the configured file', async () => {
    const intentFile = path.join(dir, 'elsewhere.json');
    await addIntent(intentFile, { description: 'Roomier', targets: ['route'] });
    const report = await changedRun({
      agent: { intentFile: 'elsewhere.json' },
    });
    expect(report.results[0]?.classification?.kind).toBe('intended');
  });
});
