import fs from 'node:fs/promises';
import type http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockInputs: Record<string, string> = {};
const mockOutputs: Record<string, string> = {};
const mockSecrets: string[] = [];

vi.mock('@actions/core', () => ({
  getInput: vi.fn((name: string) => mockInputs[name] || ''),
  setOutput: vi.fn((name: string, val: unknown) => {
    mockOutputs[name] = String(val);
  }),
  setSecret: vi.fn((secret: string) => {
    mockSecrets.push(secret);
  }),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  summary: {
    addRaw: vi.fn().mockReturnValue({
      write: vi.fn().mockResolvedValue({}),
    }),
  },
}));

vi.mock('@actions/github', () => ({
  context: {
    ref: 'refs/heads/main',
    payload: {
      repository: { default_branch: 'main' },
    },
    repo: { owner: 'Diffra', repo: 'core' },
  },
}));

vi.mock('@diffra/core', () => ({
  runVisualRegression: vi.fn().mockResolvedValue({
    runId: 'mock-run-123',
    reviewDir: '/tmp/review/mock-run-123',
    links: { review: 'https://diffra-viewer.company.com/runs/mock-run-123/' },
    timestamp: '2026-10-11T12:00:00Z',
    summary: {
      total: 2,
      passed: 2,
      unchanged: 2,
      changed: 0,
      added: 0,
      removed: 0,
    },
    results: [],
  }),
  approveBaselines: vi.fn().mockResolvedValue({ count: 2 }),
  formatMarkdownSummary: vi.fn().mockReturnValue('## Diffra Summary'),
  createGitHubNotifier: vi.fn().mockReturnValue({ notify: vi.fn() }),
  BUNDLE_INDEX_FILE: 'index.html',
}));

import { matchesBranchOrBool } from '../src/branch.js';
import { run } from '../src/index.js';
import {
  startPreviewServer,
  stopPreviewServer,
} from '../src/preview-server.js';

describe('@diffra/action branch matching', () => {
  it('matches exact branches or refs', () => {
    expect(matchesBranchOrBool('main', 'refs/heads/main')).toBe(true);
    expect(matchesBranchOrBool('master', 'refs/heads/master')).toBe(true);
    expect(matchesBranchOrBool('feat/buttons', 'refs/heads/feat/buttons')).toBe(
      true,
    );
    expect(matchesBranchOrBool('main', 'refs/heads/feature')).toBe(false);
    expect(matchesBranchOrBool('main', 'main')).toBe(true);
  });

  it('matches boolean flags', () => {
    expect(matchesBranchOrBool('true', 'refs/heads/feature')).toBe(true);
    expect(matchesBranchOrBool('true', 'refs/heads/main')).toBe(true);
    expect(matchesBranchOrBool('false', 'refs/heads/main')).toBe(false);
    expect(matchesBranchOrBool('', 'refs/heads/main')).toBe(false);
    expect(matchesBranchOrBool('false', 'refs/heads/feature')).toBe(false);
  });

  it('handles edge cases', () => {
    expect(matchesBranchOrBool('release/1.0', 'refs/heads/release/1.0')).toBe(
      true,
    );
    expect(matchesBranchOrBool('release/1.0', 'refs/heads/release/2.0')).toBe(
      false,
    );
    expect(
      matchesBranchOrBool('default-branch', 'refs/heads/main', 'main'),
    ).toBe(true);
    expect(
      matchesBranchOrBool('default-branch', 'refs/heads/feat', 'main'),
    ).toBe(false);
  });
});

describe('@diffra/action static preview server', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'diffra-action-preview-'),
    );
    await fs.writeFile(
      path.join(tempDir, 'index.html'),
      '<html><body>Root Index</body></html>',
    );
    await fs.writeFile(path.join(tempDir, 'app.js'), 'console.log("hello");');
    await fs.mkdir(path.join(tempDir, 'assets'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'assets', 'style.css'),
      'body { margin: 0; }',
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function _createMockResponse(): http.ServerResponse & {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  } {
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: '',
      writeHead(status: number, headers?: Record<string, string>) {
        res.statusCode = status;
        if (headers) Object.assign(res.headers, headers);
        return res;
      },
      end(chunk?: unknown) {
        if (chunk) res.body += String(chunk);
      },
    };
    return res as unknown as http.ServerResponse & {
      statusCode: number;
      headers: Record<string, string>;
      body: string;
    };
  }

  it('binds to dynamic port 0 and executes clean teardown', async () => {
    const preview = await startPreviewServer({ root: tempDir, port: 0 });
    expect(preview.port).toBeGreaterThan(0);
    expect(preview.url).toMatch(
      /^http:\/\/(127\.0\.0\.1|\[::1\]|localhost|\d+\.\d+\.\d+\.\d+):\d+$/,
    );

    await expect(stopPreviewServer(preview.server)).resolves.toBeUndefined();
  });
});

describe('@diffra/action execution, secret masking, and review link', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockInputs)) delete mockInputs[key];
    for (const key of Object.keys(mockOutputs)) delete mockOutputs[key];
    mockSecrets.length = 0;
  });

  it('masks the token input and sensitive environment variables with core.setSecret()', async () => {
    mockInputs.token = 'ghp_secretGithubToken123';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret-key-456';

    await run();

    expect(mockSecrets).toContain('ghp_secretGithubToken123');
    expect(mockSecrets).toContain('aws-secret-key-456');

    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  it('uses the hosted review link recorded by core and never a file:// link', async () => {
    await run();

    expect(mockOutputs.url).toBe(
      'https://diffra-viewer.company.com/runs/mock-run-123/',
    );
    expect(mockOutputs.buildUrl).toBe(
      'https://diffra-viewer.company.com/runs/mock-run-123/',
    );
    expect(mockOutputs.url).not.toContain('file://');
  });
});
