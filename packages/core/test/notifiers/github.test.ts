import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitHubNotifier } from '../../src/index.js';
import type { TestRunReport } from '../../src/types/index.js';

interface RecordedRequest {
  method: string;
  url: string;
  body: Record<string, unknown>;
  authorization: string | undefined;
}

const REPO = 'acme/widgets';
const COMMIT = 'abc1234def5678';

function report(overrides: Partial<TestRunReport['summary']> = {}) {
  return {
    runId: 'run-42',
    timestamp: '2026-01-01T00:00:00.000Z',
    git: { branch: 'feature', commit: COMMIT, baselineCommit: 'base0000' },
    summary: {
      total: 3,
      passed: 2,
      changed: 1,
      added: 0,
      removed: 0,
      failed: 0,
      unchanged: 2,
      ...overrides,
    },
    results: [],
  } satisfies TestRunReport;
}

describe('GitHub notifier', () => {
  let server: http.Server;
  let apiUrl: string;
  let requests: RecordedRequest[];
  let existingComments: Array<{ id: number; body: string }>;

  beforeEach(async () => {
    requests = [];
    existingComments = [];
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        requests.push({
          method: req.method ?? '',
          url: req.url ?? '',
          body: raw ? JSON.parse(raw) : {},
          authorization: req.headers.authorization,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(req.method === 'GET' ? JSON.stringify(existingComments) : '{}');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    apiUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function notifier(extra: Record<string, unknown> = {}) {
    return createGitHubNotifier({
      token: 'secret-token',
      repo: REPO,
      prNumber: 7,
      apiUrl,
      ...extra,
    });
  }

  it('posts a failing commit status and a PR comment against the configured API', async () => {
    await notifier({
      reportUrl: 'https://viewer.example.test/?run=run-42',
    }).notify(report());

    const status = requests.find((r) => r.url.includes('/statuses/'));
    expect(status?.method).toBe('POST');
    expect(status?.url).toBe(`/repos/${REPO}/statuses/${COMMIT}`);
    expect(status?.authorization).toBe('token secret-token');
    expect(status?.body).toMatchObject({
      state: 'failure',
      context: 'diffra/visual-tests',
      target_url: 'https://viewer.example.test/?run=run-42',
    });

    const comment = requests.find(
      (r) => r.method === 'POST' && r.url.endsWith('/issues/7/comments'),
    );
    expect(String(comment?.body.body)).toContain('Diffra Visual Regression');
  });

  it('builds the report URL from the finished report when given a function', async () => {
    await notifier({
      reportUrl: (r: TestRunReport) =>
        `https://viewer.example.test/?run=${r.runId}`,
    }).notify(report());

    const status = requests.find((r) => r.url.includes('/statuses/'));
    expect(status?.body.target_url).toBe(
      'https://viewer.example.test/?run=run-42',
    );
  });

  it('updates the existing sticky comment instead of adding another', async () => {
    existingComments = [
      { id: 99, body: '<!-- diffra-visual-report --> old summary' },
    ];
    await notifier().notify(report());

    const patch = requests.find((r) => r.method === 'PATCH');
    expect(patch?.url).toBe(`/repos/${REPO}/issues/comments/99`);
    expect(
      requests.some(
        (r) => r.method === 'POST' && r.url.endsWith('/issues/7/comments'),
      ),
    ).toBe(false);
  });

  it('reports success only when nothing changed or failed', async () => {
    await notifier().notify(report({ changed: 0, unchanged: 3, passed: 3 }));
    const ok = requests.find((r) => r.url.includes('/statuses/'));
    expect(ok?.body.state).toBe('success');

    requests = [];
    await notifier().notify(report({ changed: 0, failed: 1 }));
    const failed = requests.find((r) => r.url.includes('/statuses/'));
    expect(failed?.body.state).toBe('failure');
    expect(String(failed?.body.description)).toContain('could not be captured');
  });
});
