import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { Socket } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLI_OPTIONS,
  createServeHandler,
  formatServerUrl,
  main,
  startServeServer,
} from '../src/index.js';
import { colors, isColorSupported } from '../src/utils/colors.js';

function dispatchMockRequest(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  urlStr: string,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve) => {
    const socket = new EventEmitter();
    const req = new http.IncomingMessage(socket as unknown as Socket);
    req.url = urlStr;
    req.method = 'GET';
    const res = new http.ServerResponse(req);
    const headers: Record<string, string> = {};
    let body = '';

    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = (statusCode: number, ...args: unknown[]) => {
      res.statusCode = statusCode;
      if (args[0] && typeof args[0] === 'object') {
        Object.assign(headers, args[0]);
      }
      return origWriteHead(statusCode, ...(args as [never]));
    };

    res.write = (chunk: unknown) => {
      body += String(chunk);
      return true;
    };
    res.end = (chunk?: unknown) => {
      if (chunk) body += String(chunk);
      resolve({ status: res.statusCode, headers, body });
      return res;
    };

    handler(req, res);
  });
}

describe('@diffra/cli', () => {
  describe('Command Routing & Basic Options', () => {
    it('prints version with --version flag', async () => {
      const exitCode = await main(['--version']);
      expect(exitCode).toBe(0);
    });

    it('prints help with --help flag', async () => {
      const exitCode = await main(['--help']);
      expect(exitCode).toBe(0);
    });

    it('prints help with positional "help" subcommand', async () => {
      const exitCode = await main(['help']);
      expect(exitCode).toBe(0);
    });

    it('handles unknown commands with non-zero exit code', async () => {
      const exitCode = await main(['nonexistent-command']);
      expect(exitCode).toBe(1);
    });

    it('catches unknown options and exits with code 1 without crashing', async () => {
      const exitCode = await main(['--unknown-flag-123']);
      expect(exitCode).toBe(1);
    });

    it('catches unknown options in subcommand and exits with code 1', async () => {
      const exitCode = await main(['test', '--bogus-option']);
      expect(exitCode).toBe(1);
    });

    it('defines all canonical options in CLI_OPTIONS', () => {
      expect(CLI_OPTIONS).toHaveProperty('config');
      expect(CLI_OPTIONS).toHaveProperty('shard-dir');
      expect(CLI_OPTIONS).toHaveProperty('update-baseline');
      expect(CLI_OPTIONS).toHaveProperty('filter');
      expect(CLI_OPTIONS).toHaveProperty('ci');
      expect(CLI_OPTIONS).toHaveProperty('json');
      expect(CLI_OPTIONS['shard-dir'].multiple).toBe(true);
    });
  });

  describe('Standard Color Handling (NO_COLOR & FORCE_COLOR)', () => {
    it('disables colors when FORCE_COLOR is "0" or "false"', () => {
      const origForce = process.env.FORCE_COLOR;
      try {
        process.env.FORCE_COLOR = '0';
        expect(isColorSupported()).toBe(false);
        expect(colors.bold('Diffra')).toBe('Diffra');

        process.env.FORCE_COLOR = 'false';
        expect(isColorSupported()).toBe(false);
        expect(colors.cyan('Test')).toBe('Test');
      } finally {
        if (origForce !== undefined) process.env.FORCE_COLOR = origForce;
        else delete process.env.FORCE_COLOR;
      }
    });

    it('forces colors when FORCE_COLOR is set to non-zero/non-false value', () => {
      const origForce = process.env.FORCE_COLOR;
      const origNo = process.env.NO_COLOR;
      try {
        delete process.env.NO_COLOR;
        process.env.FORCE_COLOR = '1';
        expect(isColorSupported()).toBe(true);
        expect(colors.bold('Diffra')).toBe('\x1b[1mDiffra\x1b[22m');
        expect(colors.cyan('Review')).toBe('\x1b[36mReview\x1b[39m');
      } finally {
        if (origForce !== undefined) process.env.FORCE_COLOR = origForce;
        else delete process.env.FORCE_COLOR;
        if (origNo !== undefined) process.env.NO_COLOR = origNo;
        else delete process.env.NO_COLOR;
      }
    });

    it('disables colors when NO_COLOR is present and non-empty', () => {
      const origNo = process.env.NO_COLOR;
      const origForce = process.env.FORCE_COLOR;
      try {
        delete process.env.FORCE_COLOR;
        process.env.NO_COLOR = '1';
        expect(isColorSupported()).toBe(false);
        expect(colors.bold('Diffra')).toBe('Diffra');
        expect(colors.green('Passed')).toBe('Passed');
      } finally {
        if (origNo !== undefined) process.env.NO_COLOR = origNo;
        else delete process.env.NO_COLOR;
        if (origForce !== undefined) process.env.FORCE_COLOR = origForce;
        else delete process.env.FORCE_COLOR;
      }
    });

    it('preserves colors when NO_COLOR is empty string per no-color.org', () => {
      const origNo = process.env.NO_COLOR;
      const origForce = process.env.FORCE_COLOR;
      try {
        process.env.NO_COLOR = '';
        process.env.FORCE_COLOR = '1';
        expect(isColorSupported()).toBe(true);
        expect(colors.bold('Diffra')).toContain('\x1b[1m');
      } finally {
        if (origNo !== undefined) process.env.NO_COLOR = origNo;
        else delete process.env.NO_COLOR;
        if (origForce !== undefined) process.env.FORCE_COLOR = origForce;
        else delete process.env.FORCE_COLOR;
      }
    });
  });

  describe('merge-reports Shard Inputs', () => {
    it('exits with code 1 when no shard directories are provided', async () => {
      const exitCode = await main(['merge-reports']);
      expect(exitCode).toBe(1);
    });

    it('merges reports specified via both positional args and --shard-dir flags', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-merge-test-'),
      );
      const shard1 = path.join(tempDir, 'shard-1');
      const shard2 = path.join(tempDir, 'shard-2');
      const outDir = path.join(tempDir, 'merged-out');

      await fs.mkdir(shard1, { recursive: true });
      await fs.mkdir(shard2, { recursive: true });

      const report1 = {
        runId: 'shard-1-run',
        timestamp: new Date().toISOString(),
        summary: {
          total: 1,
          passed: 1,
          changed: 0,
          added: 0,
          removed: 0,
          unchanged: 1,
        },
        results: [
          {
            id: 'btn-1',
            name: 'Primary Button',
            status: 'unchanged' as const,
            viewport: { width: 800, height: 600 },
          },
        ],
      };

      const report2 = {
        runId: 'shard-2-run',
        timestamp: new Date().toISOString(),
        summary: {
          total: 1,
          passed: 1,
          changed: 0,
          added: 0,
          removed: 0,
          unchanged: 1,
        },
        results: [
          {
            id: 'card-1',
            name: 'User Card',
            status: 'unchanged' as const,
            viewport: { width: 800, height: 600 },
          },
        ],
      };

      await fs.writeFile(
        path.join(shard1, 'report.json'),
        JSON.stringify(report1, null, 2),
      );
      await fs.writeFile(
        path.join(shard2, 'report.json'),
        JSON.stringify(report2, null, 2),
      );

      // Test merging using --shard-dir and positionals
      const exitCode = await main([
        'merge-reports',
        '--shard-dir',
        shard1,
        shard2,
        '-o',
        outDir,
      ]);
      expect(exitCode).toBe(0);

      const mergedReportRaw = await fs.readFile(
        path.join(outDir, 'latest-report.json'),
        'utf-8',
      );
      const merged = JSON.parse(mergedReportRaw);
      expect(merged.summary.total).toBe(2);
      expect(merged.results).toHaveLength(2);

      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('Feature 19: diffra serve Preview Server', () => {
    it('binds to dynamic port 0 and normalizes server URL', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-serve-test-'),
      );
      const reportFile = path.join(tempDir, 'latest-report.json');
      await fs.writeFile(
        reportFile,
        JSON.stringify({
          runId: 'serve-test-1',
          summary: { total: 1 },
          results: [],
        }),
      );

      const instance = await startServeServer({
        reportPath: reportFile,
        outputDir: tempDir,
        port: 0,
      });

      try {
        expect(instance.port).toBeGreaterThan(0);
        expect(instance.port).not.toBe(3000);
        expect(instance.port).not.toBe(6006);
        expect(instance.url).toMatch(/^http:\/\/(127\.0\.0\.1|\[::1\]):\d+$/);

        const formatted = formatServerUrl(instance.server);
        expect(formatted).toBe(instance.url);
      } finally {
        await instance.stop();
      }

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('serves <diffra-viewer> HTML with nosniff on root route', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-serve-html-'),
      );
      const reportFile = path.join(tempDir, 'latest-report.json');
      await fs.writeFile(reportFile, JSON.stringify({ runId: 'test-run' }));

      const handler = createServeHandler({
        reportPath: reportFile,
        staticRoot: tempDir,
      });

      const res = await dispatchMockRequest(handler, '/');
      expect(res.status).toBe(200);
      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(res.headers['Content-Type']).toContain('text/html');
      expect(res.body).toContain(
        '<diffra-viewer data-report-url="./report.json"></diffra-viewer>',
      );

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('serves report.json manifest on /report.json route', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-serve-json-'),
      );
      const reportFile = path.join(tempDir, 'latest-report.json');
      const sampleReport = {
        runId: 'manifest-verification-99',
        summary: { total: 5, changed: 2 },
        results: [{ id: 'button-primary', name: 'Primary Button' }],
      };
      await fs.writeFile(reportFile, JSON.stringify(sampleReport));

      const handler = createServeHandler({
        reportPath: reportFile,
        staticRoot: tempDir,
      });

      const res = await dispatchMockRequest(handler, '/report.json');
      expect(res.status).toBe(200);
      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(res.headers['Content-Type']).toContain('application/json');
      const parsed = JSON.parse(res.body);
      expect(parsed.runId).toBe('manifest-verification-99');
      expect(parsed.summary.changed).toBe(2);

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('strictly returns 403 Forbidden on path traversal attempts per AGENTS.md Rule 6', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-serve-traversal-'),
      );
      const reportFile = path.join(tempDir, 'latest-report.json');
      await fs.writeFile(reportFile, JSON.stringify({ runId: 'test-run' }));

      const handler = createServeHandler({
        reportPath: reportFile,
        staticRoot: tempDir,
      });

      const traversalRes1 = await dispatchMockRequest(
        handler,
        '/../../../etc/passwd',
      );
      expect(traversalRes1.status).toBe(403);
      expect(traversalRes1.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(traversalRes1.body).toBe('Forbidden');

      const traversalRes2 = await dispatchMockRequest(
        handler,
        '/%2e%2e%2f%2e%2e%2fpackage.json',
      );
      expect(traversalRes2.status).toBe(403);
      expect(traversalRes2.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(traversalRes2.body).toBe('Forbidden');

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('executes diffra serve in CI mode with clean startup and graceful exit 0', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-serve-ci-'),
      );
      const reportFile = path.join(tempDir, 'report.json');
      await fs.writeFile(
        reportFile,
        JSON.stringify({ runId: 'ci-serve-test' }),
      );

      const exitCode = await main(['serve', '--report', reportFile, '--ci']);
      expect(exitCode).toBe(0);

      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });
});
