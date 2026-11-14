import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ACTION_ENTRY } from '../vite.config.js';

/**
 * Runs the production bundle the way GitHub does: from a directory that has no
 * node_modules, configured only through INPUT_* and GITHUB_* variables, against
 * a real git repository, a local page and a local stand-in for the GitHub API.
 */

const REPO_SLUG = 'acme/widgets';
const VIEWER_URL = 'https://viewer.example.test';
const TIMEOUT_MS = 90_000;

interface ApiRequest {
  method: string;
  url: string;
  body: Record<string, unknown>;
}

interface ActionRun {
  code: number | null;
  log: string;
  outputs: Record<string, string>;
  summary: string;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

/** Parses the GITHUB_OUTPUT file format: name<<delimiter, value, delimiter. */
function parseOutputs(raw: string): Record<string, string> {
  const outputs: Record<string, string> = {};
  const pattern = /^(\w+)<<(\S+)\n([\s\S]*?)\n\2$/gm;
  for (const match of raw.matchAll(pattern)) {
    const [, name, , value] = match;
    if (name) outputs[name] = value ?? '';
  }
  return outputs;
}

describe('bundled action', () => {
  let workDir: string;
  let bundleDir: string;
  let repoDir: string;
  let pageServer: http.Server;
  let apiServer: http.Server;
  let pageUrl: string;
  let deadUrl: string;
  let apiUrl: string;
  let pageColor: string;
  let apiRequests: ApiRequest[];

  async function listen(handler?: http.RequestListener) {
    const server = http.createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    return { server, port: (server.address() as AddressInfo).port };
  }

  beforeAll(async () => {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-bundle-'));
    bundleDir = path.join(workDir, 'action');
    await build({
      configFile: path.resolve(import.meta.dirname, '../vite.config.ts'),
      logLevel: 'silent',
      build: { outDir: bundleDir },
    });

    const page = await listen((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        `<body style="margin:0"><div style="width:300px;height:200px;background:${pageColor}"></div></body>`,
      );
    });
    pageServer = page.server;
    pageUrl = `http://localhost:${page.port}`;

    const api = await listen((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        apiRequests.push({
          method: req.method ?? '',
          url: req.url ?? '',
          body: raw ? JSON.parse(raw) : {},
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(req.method === 'GET' ? '[]' : '{}');
      });
    });
    apiServer = api.server;
    apiUrl = `http://localhost:${api.port}`;

    // A port that was bound and released, so connections are refused.
    const dead = await listen();
    deadUrl = `http://localhost:${dead.port}/unreachable`;
    await new Promise<void>((resolve) => dead.server.close(() => resolve()));
  }, TIMEOUT_MS);

  afterAll(async () => {
    await new Promise<void>((resolve) => pageServer.close(() => resolve()));
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    await fs.rm(workDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    apiRequests = [];
    pageColor = '#336699';
    repoDir = await fs.mkdtemp(path.join(workDir, 'repo-'));
    git(repoDir, 'init', '-b', 'main');
    git(repoDir, 'config', 'user.email', 'bundle@test.invalid');
    git(repoDir, 'config', 'user.name', 'Bundle Test');
    git(repoDir, 'config', 'commit.gpgsign', 'false');
    git(repoDir, 'commit', '--allow-empty', '-m', 'initial');
  });

  async function runAction(
    inputs: Record<string, string>,
    ref: string,
  ): Promise<ActionRun> {
    const outputFile = path.join(workDir, 'github-output.txt');
    const summaryFile = path.join(workDir, 'github-summary.md');
    await fs.writeFile(outputFile, '');
    await fs.writeFile(summaryFile, '');

    const env: Record<string, string> = {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      GITHUB_ACTIONS: 'true',
      GITHUB_OUTPUT: outputFile,
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_REPOSITORY: REPO_SLUG,
      GITHUB_REF: ref,
      GITHUB_API_URL: apiUrl,
      INPUT_TOKEN: 'test-token',
      INPUT_VIEWERURL: VIEWER_URL,
      INPUT_WORKINGDIR: repoDir,
      INPUT_CONCURRENCY: '1',
      INPUT_DRIVER: 'url',
      INPUT_STORYBOOKURL: pageUrl,
      INPUT_URLS: '/',
      INPUT_AUTOACCEPTCHANGES: 'false',
    };
    for (const [name, value] of Object.entries(inputs)) {
      env[`INPUT_${name.toUpperCase()}`] = value;
    }

    const child = spawn(
      process.execPath,
      [path.join(bundleDir, ACTION_ENTRY)],
      {
        env,
        cwd: repoDir,
      },
    );
    let log = '';
    child.stdout.on('data', (d: Buffer) => {
      log += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      log += d.toString();
    });
    const code = await new Promise<number | null>((resolve) => {
      child.on('close', resolve);
    });

    return {
      code,
      log,
      outputs: parseOutputs(await fs.readFile(outputFile, 'utf-8')),
      summary: await fs.readFile(summaryFile, 'utf-8'),
    };
  }

  const statusPosts = () =>
    apiRequests.filter(
      (r) => r.method === 'POST' && r.url.includes('/statuses/'),
    );
  const commentPosts = () =>
    apiRequests.filter(
      (r) => r.method === 'POST' && r.url.endsWith('/issues/7/comments'),
    );

  it(
    'runs from a clean directory and reports to the pull request',
    async () => {
      const result = await runAction({}, 'refs/pull/7/merge');

      expect(result.log).not.toContain('Cannot find module');
      expect(result.code).toBe(0);
      expect(result.outputs.status).toBe('passed');
      expect(result.outputs.storyCount).toBe('1');
      expect(result.outputs.failedCount).toBe('0');
      expect(result.outputs.url).toMatch(
        new RegExp(`^${VIEWER_URL}/\\?run=run-`),
      );
      expect(result.summary).toContain('Diffra Visual Regression');

      expect(statusPosts()).toHaveLength(1);
      expect(statusPosts()[0]?.url).toContain(`/repos/${REPO_SLUG}/statuses/`);
      expect(statusPosts()[0]?.body.state).toBe('success');
      expect(String(statusPosts()[0]?.body.target_url)).toBe(
        result.outputs.url,
      );
      expect(commentPosts()).toHaveLength(1);
    },
    TIMEOUT_MS,
  );

  it(
    'fails the step and the commit status when a target cannot be captured',
    async () => {
      const result = await runAction(
        { urls: `/,${deadUrl}` },
        'refs/pull/7/merge',
      );

      expect(result.code).toBe(1);
      expect(result.outputs.status).toBe('failed');
      expect(result.outputs.failedCount).toBe('1');
      expect(statusPosts()[0]?.body.state).toBe('failure');
      expect(String(statusPosts()[0]?.body.description)).toContain(
        'could not be captured',
      );
    },
    TIMEOUT_MS,
  );

  it(
    'promotes baselines on the default branch and reports later changes',
    async () => {
      const accepted = await runAction(
        { autoAcceptChanges: 'true' },
        'refs/heads/main',
      );
      expect(accepted.code).toBe(0);
      expect(accepted.log).toContain('promoted 1 snapshots');
      // No pull request on a branch push: only the commit status is posted.
      expect(commentPosts()).toHaveLength(0);
      expect(statusPosts()).toHaveLength(1);

      apiRequests = [];
      pageColor = '#cc3366';
      const changed = await runAction({}, 'refs/pull/7/merge');

      expect(changed.code).toBe(0);
      expect(changed.outputs.status).toBe('changes_found');
      expect(changed.outputs.changeCount).toBe('1');
      expect(statusPosts()[0]?.body.state).toBe('failure');
    },
    TIMEOUT_MS,
  );
});
