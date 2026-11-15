import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  APPROVALS_FILE,
  type ApprovalPolicy,
  addIntent,
  approveBaselines,
  DEFAULT_INTENT_FILE,
  type DiffraConfig,
  proveSnapshot,
  readApprovals,
  runVisualRegression,
  suggestFixes,
  type TestRunReport,
  type VisualDriver,
  verifyRun,
} from '@diffra/core';
import { decodePng, encodePng } from '@diffra/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDiffraServer } from '../src/index.js';
import type { McpServer } from '../src/server.js';
import {
  DirectorySource,
  LocalRunSource,
  resolveWithin,
} from '../src/source.js';

const SIZE = 96;
const TARGET = { id: 'card--default', name: 'Card', group: 'Components' };

/** A white image with a red square, whose position says which version it is. */
function page(squareAt: number): Buffer {
  const data = Buffer.alloc(SIZE * SIZE * 4, 255);
  for (let y = squareAt; y < squareAt + 8; y++) {
    for (let x = squareAt; x < squareAt + 8; x++) {
      const i = (y * SIZE + x) * 4;
      data[i] = 220;
      data[i + 1] = 20;
      data[i + 2] = 20;
    }
  }
  return encodePng(data, SIZE, SIZE);
}

interface Result {
  content: Array<{ type: string; text?: string; data?: string }>;
  isError?: boolean;
}

async function call(
  server: McpServer,
  name: string,
  args: Record<string, unknown> = {},
): Promise<Result> {
  const response = await server.handle({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  });
  if (response?.error) throw new Error(response.error.message);
  return response?.result as Result;
}

const textOf = (result: Result) =>
  result.content.map((c) => c.text ?? '').join('\n');

describe('Diffra tools', () => {
  let dir: string;
  let outputDir: string;
  let squareAt: number;
  let latest: TestRunReport;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-mcp-'));
    outputDir = path.join(dir, '.diffra');
    squareAt = 10;
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const driver: VisualDriver = {
    name: 'pages',
    discover: async () => [{ ...TARGET, filePath: 'src/card.stories.tsx' }],
    capture: async () => page(squareAt),
  };

  const config = (
    extra: Partial<DiffraConfig> = {},
  ): Partial<DiffraConfig> => ({
    drivers: [driver],
    storage: { provider: 'local', outputDir },
    snapshot: { viewports: [{ width: SIZE, height: SIZE }] },
    ...extra,
  });

  /** A project with an approved baseline and a later run in which the square moved. */
  async function projectWithChange(
    approvalPolicy?: ApprovalPolicy,
  ): Promise<McpServer> {
    const first = await runVisualRegression({ cwd: dir, config: config() });
    await approveBaselines({ cwd: dir, config: config(), report: first });
    squareAt = 20;
    latest = await runVisualRegression({ cwd: dir, config: config() });
    return createDiffraServer({
      source: new LocalRunSource(outputDir),
      approvalPolicy,
      actions: {
        run: async ({ filter }) =>
          runVisualRegression({
            cwd: dir,
            config: config(
              filter ? { runner: { concurrency: 1, filter } } : {},
            ),
          }),
        approve: ({ ids, rationale }) =>
          approveBaselines({
            cwd: dir,
            config: config(),
            ids,
            provenance: { actor: 'agent', rationale },
          }),
        declareIntent: (input) =>
          addIntent(path.join(dir, DEFAULT_INTENT_FILE), input),
        prove: (options) =>
          proveSnapshot({ cwd: dir, config: config(), ...options }),
        suggestFixes: (explanation) => suggestFixes({ explanation, cwd: dir }),
        verify: (options) =>
          verifyRun({ cwd: dir, config: config(), ...options }),
      },
    });
  }

  it('reports the status of the latest run', async () => {
    const server = await projectWithChange();
    const status = JSON.parse(textOf(await call(server, 'diffra_status')));
    expect(status).toMatchObject({
      runId: latest.runId,
      schemaVersion: 1,
      summary: { changed: 1 },
      canRunAndApprove: true,
    });
  });

  it('lists the change with its source file and what it means', async () => {
    const server = await projectWithChange();
    const [change] = JSON.parse(
      textOf(await call(server, 'diffra_list_changes')),
    );
    expect(change).toMatchObject({
      id: TARGET.id,
      status: 'changed',
      filePath: 'src/card.stories.tsx',
      viewport: { width: SIZE, height: SIZE },
    });
    expect(change.regions).toBeGreaterThan(0);
    expect(change.note).toMatch(/differs from its baseline/);
  });

  it('returns the diff image of the whole snapshot by default', async () => {
    const server = await projectWithChange();
    const result = await call(server, 'diffra_view', { id: TARGET.id });
    const images = result.content.filter((c) => c.type === 'image');
    expect(images).toHaveLength(1);
    expect(decodePng(Buffer.from(images[0]?.data ?? '', 'base64')).width).toBe(
      SIZE,
    );
  });

  it('crops baseline and candidate to one region', async () => {
    const server = await projectWithChange();
    const result = await call(server, 'diffra_view', {
      id: TARGET.id,
      region: 0,
      padding: 0,
    });
    const images = result.content.filter((c) => c.type === 'image');
    expect(images).toHaveLength(2);
    for (const image of images) {
      const decoded = decodePng(Buffer.from(image.data ?? '', 'base64'));
      expect(decoded.width).toBeLessThan(SIZE);
      expect(decoded.height).toBeLessThan(SIZE);
    }
    expect(textOf(result)).toMatch(/baseline, region 0/);
    expect(textOf(result)).toMatch(/candidate, region 0/);
  });

  it('tells the agent when a snapshot or region does not exist', async () => {
    const server = await projectWithChange();
    const unknown = await call(server, 'diffra_view', { id: 'nope' });
    expect(unknown.isError).toBe(true);
    expect(textOf(unknown)).toMatch(/diffra_list_changes/);

    const region = await call(server, 'diffra_view', {
      id: TARGET.id,
      region: 99,
    });
    expect(region.isError).toBe(true);
    expect(textOf(region)).toMatch(/region 99 does not exist/);
  });

  it('runs only what the filter matches', async () => {
    const server = await projectWithChange();
    const none = JSON.parse(
      textOf(await call(server, 'diffra_run', { filter: 'no-such-target' })),
    );
    expect(none.summary.total).toBe(0);
    const all = JSON.parse(textOf(await call(server, 'diffra_run', {})));
    expect(all.changes[0]).toMatchObject({ id: TARGET.id, status: 'changed' });
  });

  it('approves only the ids it is given, with a reason, and records it', async () => {
    const server = await projectWithChange('any');
    const missing = await call(server, 'diffra_approve', {});
    expect(missing.isError).toBe(true);
    expect(textOf(missing)).toMatch(/"ids" is required/);
    const noReason = await call(server, 'diffra_approve', { ids: [TARGET.id] });
    expect(noReason.isError).toBe(true);
    expect(textOf(noReason)).toMatch(/"rationale" is required/);

    const approved = JSON.parse(
      textOf(
        await call(server, 'diffra_approve', {
          ids: [TARGET.id],
          rationale: 'The card is meant to move.',
        }),
      ),
    );
    expect(approved).toMatchObject({ approved: 1, failed: 0 });

    // The first baseline was approved by a person when the project was set up.
    const records = (
      await readApprovals(path.join(outputDir, APPROVALS_FILE))
    ).filter((record) => record.actor === 'agent');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      actor: 'agent',
      rationale: 'The card is meant to move.',
      snapshots: [{ id: TARGET.id, status: 'changed' }],
    });

    const rerun = JSON.parse(textOf(await call(server, 'diffra_run', {})));
    expect(rerun.summary.unchanged).toBe(1);
  });

  it('judges a run against an intent declared through the server', async () => {
    const server = await projectWithChange('intended');

    await call(server, 'diffra_declare_intent', {
      description: 'Restyle the header',
      targets: ['header'],
    });
    const collateral = JSON.parse(textOf(await call(server, 'diffra_run', {})));
    expect(collateral.summary).toMatchObject({ intended: 0, collateral: 1 });
    expect(collateral.changes[0].classification.kind).toBe('collateral');
    const refused = await call(server, 'diffra_approve', {
      ids: [TARGET.id],
      rationale: 'Looks fine.',
    });
    expect(refused.isError).toBe(true);
    expect(textOf(refused)).toMatch(/approval policy "intended"/);

    await call(server, 'diffra_declare_intent', {
      description: 'Redesign the card',
      targets: ['card'],
    });
    const intended = JSON.parse(textOf(await call(server, 'diffra_run', {})));
    expect(intended.summary).toMatchObject({ intended: 1, collateral: 0 });
    const approved = await call(server, 'diffra_approve', {
      ids: [TARGET.id],
      rationale: 'The card redesign is the task.',
    });
    expect(approved.isError).toBeUndefined();
  });

  it('reads the latest report as a resource', async () => {
    const server = await projectWithChange();
    const response = await server.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'resources/read',
      params: { uri: 'diffra://run/latest' },
    });
    expect(response?.error).toBeUndefined();
    const { contents } = (response?.result ?? { contents: [] }) as {
      contents: Array<{ text: string }>;
    };
    expect(JSON.parse(contents[0]?.text ?? '').runId).toBe(latest.runId);
  });

  describe('a published bundle', () => {
    it('can be read but not changed', async () => {
      await projectWithChange();
      const bundle = new DirectorySource(
        path.join(outputDir, 'runs', latest.runId),
      );
      const server = createDiffraServer({ source: bundle });

      const status = JSON.parse(textOf(await call(server, 'diffra_status')));
      expect(status.canRunAndApprove).toBe(false);
      const view = await call(server, 'diffra_view', {
        id: TARGET.id,
        region: 0,
      });
      expect(view.content.some((c) => c.type === 'image')).toBe(true);

      for (const [name, args] of [
        ['diffra_run', {}],
        ['diffra_approve', { ids: [TARGET.id], rationale: 'x' }],
      ] as const) {
        const refused = await call(server, name, args);
        expect(refused.isError).toBe(true);
        expect(textOf(refused)).toMatch(/read-only/);
      }
    });

    it('refuses an image path that leaves the bundle', async () => {
      const source = new DirectorySource(dir);
      await expect(source.readImage('../../etc/passwd')).rejects.toThrow(
        /leaves the review bundle/,
      );
      expect(() => resolveWithin(dir, '/etc/passwd')).toThrow(/leaves/);
      expect(resolveWithin(dir, 'images/a.png')).toBe(
        path.join(dir, 'images', 'a.png'),
      );
    });
  });
});

describe('diffra_explain', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-mcp-explain-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** A bundle holding a report with the given results and no images. */
  async function bundleWith(results: unknown[]): Promise<McpServer> {
    await fs.writeFile(
      path.join(dir, 'report.json'),
      JSON.stringify({
        runId: 'run-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        summary: { total: results.length },
        results,
      }),
    );
    return createDiffraServer({ source: new DirectorySource(dir) });
  }

  const base = {
    group: 'Components',
    browser: 'chromium',
    viewport: { width: 100, height: 100 },
    candidate: {},
  };

  it('returns the causes and regions of a changed snapshot', async () => {
    const server = await bundleWith([
      {
        ...base,
        id: 'button--primary',
        name: 'Primary',
        status: 'changed',
        diff: { boundingBoxes: [{ minX: 0, minY: 0, maxX: 31, maxY: 31 }] },
        explanation: {
          summary: 'button#go: padding 16px to 32px (src/card.css .btn).',
          causes: [{ element: { tag: 'button' }, confidence: 'attributed' }],
          regions: [{ index: 0, box: {}, causes: [0] }],
        },
      },
    ]);
    const explained = JSON.parse(
      textOf(await call(server, 'diffra_explain', { id: 'button--primary' })),
    );
    expect(explained.summary).toMatch(/padding 16px to 32px/);
    expect(explained.causes).toHaveLength(1);
    expect(explained.regions[0].causes).toEqual([0]);

    const [listed] = JSON.parse(
      textOf(await call(server, 'diffra_list_changes')),
    );
    expect(listed.why).toBe(explained.summary);
  });

  it('says why a changed snapshot has no explanation', async () => {
    const server = await bundleWith([
      { ...base, id: 'plain', name: 'Plain', status: 'changed' },
    ]);
    const explained = JSON.parse(
      textOf(await call(server, 'diffra_explain', { id: 'plain' })),
    );
    expect(explained.note).toMatch(/No page context was recorded/);
    expect(explained).not.toHaveProperty('causes');
  });

  it('explains the state of a snapshot that has nothing to compare', async () => {
    const server = await bundleWith([
      { ...base, id: 'fresh', name: 'Fresh', status: 'added' },
    ]);
    const explained = JSON.parse(
      textOf(await call(server, 'diffra_explain', { id: 'fresh' })),
    );
    expect(explained.note).toMatch(/new/);
  });
});

describe('intent tools', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-mcp-intent-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const result = (id: string, kind?: 'intended' | 'collateral') => ({
    id,
    name: id,
    group: 'Components',
    browser: 'chromium',
    viewport: { width: 100, height: 100 },
    status: 'changed',
    candidate: {},
    ...(kind ? { classification: { kind, reason: `Because of ${id}.` } } : {}),
  });

  async function serverWith(
    results: unknown[],
    approvalPolicy?: ApprovalPolicy,
  ) {
    await fs.writeFile(
      path.join(dir, 'report.json'),
      JSON.stringify({
        runId: 'run-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        gate: 'collateral',
        intents: [
          {
            id: 'intent-1',
            description: 'Roomier buttons',
            author: 'agent',
            createdAt: '2026-01-01T00:00:00.000Z',
            targets: ['a'],
          },
        ],
        summary: { total: results.length },
        results,
      }),
    );
    const actions = {
      run: vi.fn(),
      approve: vi.fn(async ({ ids }: { ids: string[] }) => ({
        count: ids.length,
        failed: 0,
      })),
      declareIntent: vi.fn(async (input: Record<string, unknown>) => ({
        id: 'intent-9',
        createdAt: '2026-01-01T00:00:00.000Z',
        ...input,
      })),
      suggestFixes: vi.fn(async () => ({
        suggestions: [
          {
            element: { tag: 'button' },
            restore: [],
            patch: '--- a/x\n',
            note: 'n',
          },
        ],
        note: 'Each suggestion undoes a change.',
      })),
      verify: vi.fn(async () => ({
        report: {
          runId: 'run-2',
          summary: { total: 1, changed: 0 },
          results: [],
        },
        verification: {
          resolved: [{ id: 'a', viewport: { width: 100, height: 100 } }],
          stillChanged: [],
          newlyChanged: [],
          notChecked: [],
          summary: '1 resolved.',
        },
        affected: { ids: ['a'], ran: 'affected', unmatchedFiles: [] },
      })),
      prove: vi.fn(async ({ id }: { id: string }) => ({
        id,
        explanation: {
          summary:
            'button: padding 8px to 16px. Proven: undoing it restored the baseline.',
          causes: [
            {
              element: { tag: 'button' },
              confidence: 'proven',
              changes: [],
              displaced: 0,
            },
          ],
          regions: [],
          proof: {
            status: 'proven',
            reverted: 1,
            note: 'Undoing this change in the page restored the baseline.',
          },
        },
      })),
    };
    const server = createDiffraServer({
      source: new DirectorySource(dir),
      approvalPolicy,
      actions: actions as never,
    });
    return { server, actions };
  }

  it('declares an intent as the agent', async () => {
    const { server, actions } = await serverWith([]);
    const declared = JSON.parse(
      textOf(
        await call(server, 'diffra_declare_intent', {
          description: 'Roomier buttons',
          sources: ['src/button.css'],
        }),
      ),
    );
    expect(declared.intent).toMatchObject({ id: 'intent-9', author: 'agent' });
    expect(actions.declareIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Roomier buttons',
        sources: ['src/button.css'],
        author: 'agent',
      }),
    );
  });

  it('shows the classification of each change, and the gate and intents in the status', async () => {
    const { server } = await serverWith([
      result('a', 'intended'),
      result('b', 'collateral'),
    ]);
    const list = JSON.parse(textOf(await call(server, 'diffra_list_changes')));
    expect(
      list.map(
        (c: { classification: { kind: string } }) => c.classification.kind,
      ),
    ).toEqual(['intended', 'collateral']);
    const status = JSON.parse(textOf(await call(server, 'diffra_status')));
    expect(status.gate).toBe('collateral');
    expect(status.intents).toEqual([
      { id: 'intent-1', description: 'Roomier buttons', author: 'agent' },
    ]);
  });

  describe('approval policy', () => {
    const rationale = 'Because the task says so.';
    const withProof = (id: string, status: 'proven' | 'unproven') => ({
      ...result(id, 'intended'),
      explanation: {
        summary: '',
        causes: [],
        regions: [],
        proof: { status, reverted: 1, note: '' },
      },
    });

    it('by default approves intended changes and refuses the rest, saying why', async () => {
      const { server, actions } = await serverWith([
        result('a', 'intended'),
        result('b', 'collateral'),
        result('c'),
      ]);
      const refused = await call(server, 'diffra_approve', {
        ids: ['a', 'b', 'c'],
        rationale,
      });
      expect(refused.isError).toBe(true);
      expect(textOf(refused)).toMatch(/approval policy "intended"/);
      expect(textOf(refused)).toMatch(/- "b": /);
      expect(textOf(refused)).toMatch(/- "c": .*intent/);
      expect(textOf(refused)).not.toMatch(/- "a":/);
      expect(textOf(refused)).toMatch(/diffra approve/);
      expect(actions.approve).not.toHaveBeenCalled();

      const intended = await call(server, 'diffra_approve', {
        ids: ['a'],
        rationale,
      });
      expect(intended.isError).toBeUndefined();
      // The report the policy was checked against travels with the approval,
      // so a run that finishes meanwhile cannot be promoted instead.
      expect(actions.approve).toHaveBeenCalledWith({
        ids: ['a'],
        rationale,
        report: expect.objectContaining({ results: expect.any(Array) }),
      });
    });

    it('refuses everything when agents may not approve', async () => {
      const { server, actions } = await serverWith(
        [result('a', 'intended')],
        'never',
      );
      const refused = await call(server, 'diffra_approve', {
        ids: ['a'],
        rationale,
      });
      expect(refused.isError).toBe(true);
      expect(textOf(refused)).toMatch(/never/);
      expect(actions.approve).not.toHaveBeenCalled();
    });

    it('needs a proven cause as well when the policy is proven', async () => {
      const { server, actions } = await serverWith(
        [
          withProof('p', 'proven'),
          withProof('u', 'unproven'),
          result('i', 'intended'),
        ],
        'proven',
      );
      const refused = await call(server, 'diffra_approve', {
        ids: ['p', 'u', 'i'],
        rationale,
      });
      expect(refused.isError).toBe(true);
      expect(textOf(refused)).toMatch(/- "u": /);
      expect(textOf(refused)).toMatch(/- "i": .*diffra_prove/);
      expect(textOf(refused)).not.toMatch(/- "p":/);
      expect(actions.approve).not.toHaveBeenCalled();

      const proven = await call(server, 'diffra_approve', {
        ids: ['p'],
        rationale,
      });
      expect(proven.isError).toBeUndefined();
    });

    it('lets an agent approve anything when the policy is any', async () => {
      const { server, actions } = await serverWith(
        [result('b', 'collateral')],
        'any',
      );
      const allowed = await call(server, 'diffra_approve', {
        ids: ['b'],
        rationale,
      });
      expect(allowed.isError).toBeUndefined();
      expect(actions.approve).toHaveBeenCalledTimes(1);
    });
  });

  it('proves a cause and reports how sure it now is', async () => {
    const { server, actions } = await serverWith([result('a')]);
    const proved = JSON.parse(
      textOf(await call(server, 'diffra_prove', { id: 'a', width: 100 })),
    );
    expect(proved.proof.status).toBe('proven');
    expect(proved.causes).toEqual([
      { element: { tag: 'button' }, confidence: 'proven' },
    ]);
    expect(actions.prove).toHaveBeenCalledWith({
      id: 'a',
      browser: undefined,
      width: 100,
      height: undefined,
    });
  });

  it('verifies a change and says what was resolved', async () => {
    const { server, actions } = await serverWith([]);
    const verified = JSON.parse(
      textOf(await call(server, 'diffra_verify', { affected: true })),
    );
    expect(verified.verification.summary).toBe('1 resolved.');
    expect(verified.affected.ran).toBe('affected');
    expect(actions.verify).toHaveBeenCalledWith({
      filter: undefined,
      affected: true,
    });

    const bad = await call(server, 'diffra_verify', { affected: 'yes' });
    expect(bad.isError).toBe(true);
  });

  it('suggests a fix for a snapshot that has an explanation', async () => {
    const { server, actions } = await serverWith([
      {
        ...result('a'),
        explanation: { summary: 's', causes: [], regions: [] },
      },
      result('b'),
    ]);
    const fixed = JSON.parse(
      textOf(await call(server, 'diffra_suggest_fix', { id: 'a' })),
    );
    expect(fixed.suggestions[0].patch).toBe('--- a/x\n');
    expect(actions.suggestFixes).toHaveBeenCalledTimes(1);

    const none = JSON.parse(
      textOf(await call(server, 'diffra_suggest_fix', { id: 'b' })),
    );
    expect(none.suggestions).toEqual([]);
    expect(none.note).toMatch(/No page context was recorded/);
    expect(actions.suggestFixes).toHaveBeenCalledTimes(1);
  });

  it('cannot declare an intent on a read-only server', async () => {
    await fs.writeFile(
      path.join(dir, 'report.json'),
      JSON.stringify({ runId: 'r', timestamp: 't', summary: {}, results: [] }),
    );
    const server = createDiffraServer({ source: new DirectorySource(dir) });
    const refused = await call(server, 'diffra_declare_intent', {
      description: 'x',
      targets: ['a'],
    });
    expect(refused.isError).toBe(true);
    expect(textOf(refused)).toMatch(/read-only/);
    const noProof = await call(server, 'diffra_prove', { id: 'a' });
    expect(noProof.isError).toBe(true);
    expect(textOf(noProof)).toMatch(/read-only/);
    const noFix = await call(server, 'diffra_suggest_fix', { id: 'a' });
    expect(noFix.isError).toBe(true);
    const noVerify = await call(server, 'diffra_verify', {});
    expect(noVerify.isError).toBe(true);
  });
});
