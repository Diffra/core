import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    runId: 'stress-run-777',
    reviewDir: '/tmp/review/stress-run-777',
    links: {
      review: 'https://visual-regression.acme.corp/runs/stress-run-777/',
    },
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
  createGitHubNotifier: vi.fn().mockReturnValue({ notify: vi.fn() }),
  BUNDLE_INDEX_FILE: 'index.html',
}));

import { run } from '../src/index.js';

describe('action secret masking and review links', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockInputs)) delete mockInputs[key];
    for (const key of Object.keys(mockOutputs)) delete mockOutputs[key];
    mockSecrets.length = 0;
  });

  it('masks the token input via core.setSecret()', async () => {
    mockInputs.token = 'github-pat-token-456';

    await run();

    expect(mockSecrets).toContain('github-pat-token-456');
  });

  it('masks process.env.GITHUB_TOKEN when token input is not explicitly passed', async () => {
    process.env.GITHUB_TOKEN = 'env-github-token-999';

    await run();

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

  it('outputs the hosted review link and never a file:// link', async () => {
    await run();

    expect(mockOutputs.url).toBe(
      'https://visual-regression.acme.corp/runs/stress-run-777/',
    );
    expect(mockOutputs.buildUrl).toBe(
      'https://visual-regression.acme.corp/runs/stress-run-777/',
    );
    expect(mockOutputs.url).not.toContain('file://');
  });
});
