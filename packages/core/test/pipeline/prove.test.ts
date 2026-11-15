import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  approveBaselines,
  type DiffraConfig,
  proveSnapshot,
  runVisualRegression,
} from '../../src/index.js';

const VIEWPORT = { width: 320, height: 200 };
const ID = 'route--home';

interface State {
  padding: number;
  label: string;
  noteColor: string;
}

const page = (s: State) => `<!doctype html><html><head>
<style data-vite-dev-id="/src/card.css">
  .btn { padding: ${s.padding}px; background: rgb(30, 90, 200); color: white; border: 0; font: 16px sans-serif; }
  .note { color: ${s.noteColor}; font: 14px sans-serif; margin: 12px 0 0; }
</style></head><body style="margin:0">
<button class="btn" id="go">${s.label}</button><p class="note" id="note">Saved just now</p></body></html>`;

describe('proving a cause', () => {
  let dir: string;
  let server: http.Server;
  let baseUrl: string;
  let state: State;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-prove-'));
    state = { padding: 16, label: 'Save', noteColor: 'rgb(90, 90, 90)' };
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(page(state));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(dir, { recursive: true, force: true });
  });

  const config: () => Partial<DiffraConfig> = () => ({
    drivers: { driver: 'url', baseUrl, urls: ['/'] },
    storage: { provider: 'local', outputDir: path.join(dir, '.diffra') },
    snapshot: { viewports: [VIEWPORT], delay: 0 },
  });

  /** Approves the page as it is, applies the change, and runs again. */
  async function changedRun(change: Partial<State>) {
    const first = await runVisualRegression({ cwd: dir, config: config() });
    await approveBaselines({ cwd: dir, config: config(), report: first });
    Object.assign(state, change);
    return runVisualRegression({ cwd: dir, config: config() });
  }

  const latestOnDisk = async () =>
    JSON.parse(
      await fs.readFile(
        path.join(dir, '.diffra', 'latest-report.json'),
        'utf-8',
      ),
    );

  it('proves a single style change by undoing it', async () => {
    const run = await changedRun({ padding: 32 });
    expect(run.results[0]?.explanation?.causes[0]?.confidence).toBe(
      'attributed',
    );

    const { explanation } = await proveSnapshot({
      cwd: dir,
      config: config(),
      id: ID,
    });
    expect(explanation.proof).toMatchObject({ status: 'proven', reverted: 1 });
    expect(explanation.causes).toHaveLength(1);
    expect(explanation.causes[0]?.confidence).toBe('proven');
    expect(explanation.summary).toMatch(
      /Proven: undoing it restored the baseline\.$/,
    );
  });

  it('records the proof where the run is read from', async () => {
    await changedRun({ padding: 32 });
    await proveSnapshot({ cwd: dir, config: config(), id: ID });

    const saved = await latestOnDisk();
    expect(saved.results[0].explanation.proof.status).toBe('proven');
    const inRun = JSON.parse(
      await fs.readFile(
        path.join(dir, '.diffra', 'runs', saved.runId, 'report.json'),
        'utf-8',
      ),
    );
    expect(inRun.results[0].explanation.causes[0].confidence).toBe('proven');
  });

  it('does not claim a proof when part of the change cannot be undone', async () => {
    await changedRun({ padding: 32, label: 'Save changes' });
    const { explanation } = await proveSnapshot({
      cwd: dir,
      config: config(),
      id: ID,
    });
    expect(explanation.proof?.status).toBe('unproven');
    expect(explanation.proof?.remainingRegions).toBeGreaterThan(0);
    expect(explanation.proof?.note).toMatch(/did not restore the baseline/);
    expect(explanation.causes.every((c) => c.confidence === 'attributed')).toBe(
      true,
    );
    expect(explanation.summary).toMatch(
      /Not proven: undoing it did not restore/,
    );
  });

  it('proves independent causes together without crediting each alone', async () => {
    await changedRun({ padding: 32, noteColor: 'rgb(200, 0, 0)' });
    const { explanation } = await proveSnapshot({
      cwd: dir,
      config: config(),
      id: ID,
    });
    expect(explanation.causes).toHaveLength(2);
    expect(explanation.proof).toMatchObject({ status: 'proven', reverted: 2 });
    // Neither change alone brings the baseline back, so neither is proven alone.
    expect(explanation.causes.every((c) => c.confidence === 'attributed')).toBe(
      true,
    );
    expect(explanation.proof?.note).toMatch(/none of them alone did/);
  });

  it('refuses a snapshot that has nothing to prove', async () => {
    const first = await runVisualRegression({ cwd: dir, config: config() });
    await approveBaselines({ cwd: dir, config: config(), report: first });
    const same = await runVisualRegression({ cwd: dir, config: config() });
    expect(same.results[0]?.status).toBe('unchanged');
    await expect(
      proveSnapshot({ cwd: dir, config: config(), id: ID }),
    ).rejects.toThrow(/only a changed snapshot has a cause to test/);
    await expect(
      proveSnapshot({ cwd: dir, config: config(), id: 'nope' }),
    ).rejects.toThrow(/No snapshot "nope"/);
  });
});
