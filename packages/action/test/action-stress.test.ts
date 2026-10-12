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
    runId: 'stress-run-777',
    timestamp: '2026-10-11T12:00:00Z',
    summary: {
      total: 1,
      passed: 1,
      unchanged: 1,
      changed: 0,
      added: 0,
      removed: 0,
    },
    results: [],
  }),
  approveBaselines: vi.fn().mockResolvedValue({ count: 1 }),
  formatMarkdownSummary: vi.fn().mockReturnValue('## Diffra Summary'),
}));

import { run } from '../src/index.js';
import { createPreviewHandler } from '../src/preview-server.js';

describe('Milestone 3 Adversarial Challenge: Action Secret Masking & Review Links', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockInputs)) delete mockInputs[key];
    for (const key of Object.keys(mockOutputs)) delete mockOutputs[key];
    mockSecrets.length = 0;
  });

  it('masks both projectToken and token independently via core.setSecret()', async () => {
    mockInputs.projectToken = 'super-secret-project-token';
    mockInputs.token = 'github-pat-token-456';

    await run();

    expect(mockSecrets).toContain('super-secret-project-token');
    expect(mockSecrets).toContain('github-pat-token-456');
  });

  it('masks process.env.GITHUB_TOKEN when token input is not explicitly passed', async () => {
    mockInputs.projectToken = 'project-only-token';
    process.env.GITHUB_TOKEN = 'env-github-token-999';

    await run();

    expect(mockSecrets).toContain('project-only-token');
    expect(mockSecrets).toContain('env-github-token-999');

    delete process.env.GITHUB_TOKEN;
  });

  it('masks all sensitive storage and notification environment variables', async () => {
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret-test';
    process.env.AWS_SESSION_TOKEN = 'aws-session-test';
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'azure-conn-test';
    process.env.AZURE_STORAGE_KEY = 'azure-key-test';
    process.env.SLACK_WEBHOOK_URL = 'slack-webhook-test';
    process.env.FIGMA_ACCESS_TOKEN = 'figma-token-test';

    await run();

    expect(mockSecrets).toContain('aws-secret-test');
    expect(mockSecrets).toContain('aws-session-test');
    expect(mockSecrets).toContain('azure-conn-test');
    expect(mockSecrets).toContain('azure-key-test');
    expect(mockSecrets).toContain('slack-webhook-test');
    expect(mockSecrets).toContain('figma-token-test');

    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.AZURE_STORAGE_KEY;
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.FIGMA_ACCESS_TOKEN;
  });

  it('outputs clean review links starting with viewerUrl and free of file://', async () => {
    mockInputs.viewerUrl = 'https://visual-regression.acme.corp';

    await run();

    expect(mockOutputs.url).toBe(
      'https://visual-regression.acme.corp/?run=stress-run-777',
    );
    expect(mockOutputs.buildUrl).toBe(
      'https://visual-regression.acme.corp/?run=stress-run-777',
    );
    expect(mockOutputs.reportUrl).toBe(
      'https://visual-regression.acme.corp/?run=stress-run-777',
    );
    expect(mockOutputs.url).not.toContain('file://');
  });
});

describe('Milestone 3 Adversarial Challenge: Preview Server Traversal & Symlink Attacks', () => {
  let tempRoot: string;
  let outsideDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-stress-root-'));
    outsideDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'diffra-stress-outside-'),
    );

    await fs.writeFile(
      path.join(tempRoot, 'index.html'),
      '<html>Safe Root</html>',
    );
    await fs.writeFile(path.join(outsideDir, 'shadow.txt'), 'classified-data');

    // Create a symlink pointing to outside sensitive directory
    try {
      await fs.symlink(
        path.join(outsideDir, 'shadow.txt'),
        path.join(tempRoot, 'symlink-leak.txt'),
      );
    } catch {}
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
    await fs.rm(outsideDir, { recursive: true, force: true });
  });

  function createMockResponse(): http.ServerResponse & {
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

  it('rejects URL-encoded traversals and symlink bypasses with HTTP 403 Forbidden', async () => {
    const handler = createPreviewHandler(tempRoot);

    const attacks = [
      '/%2e%2e/etc/passwd',
      '/%2e%2e%2f%2e%2e%2fshadow.txt',
      '/..%2f..%2fshadow.txt',
      '/symlink-leak.txt',
    ];

    for (const attackUrl of attacks) {
      const req = { url: attackUrl } as http.IncomingMessage;
      const res = createMockResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(res.body).toBe('Forbidden');
    }
  });

  it('returns nosniff on 200, 403, and 404 responses', async () => {
    const handler = createPreviewHandler(tempRoot);

    // 200 OK
    const req200 = { url: '/index.html' } as http.IncomingMessage;
    const res200 = createMockResponse();
    await handler(req200, res200);
    expect(res200.statusCode).toBe(200);
    expect(res200.headers['X-Content-Type-Options']).toBe('nosniff');

    // 404 Not Found
    const req404 = { url: '/non-existent-asset.js' } as http.IncomingMessage;
    const res404 = createMockResponse();
    await handler(req404, res404);
    expect(res404.statusCode).toBe(404);
    expect(res404.headers['X-Content-Type-Options']).toBe('nosniff');

    // 403 Forbidden
    const req403 = { url: '/../forbidden' } as http.IncomingMessage;
    const res403 = createMockResponse();
    await handler(req403, res403);
    expect(res403.statusCode).toBe(403);
    expect(res403.headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
