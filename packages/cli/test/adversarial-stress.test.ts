import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { Socket } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { Duplex } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createServeHandler, main, startServeServer } from '../src/index.js';
import { colors, isColorSupported } from '../src/utils/colors.js';

function dispatchMockRequest(
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => void | Promise<void>,
  urlStr: string,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
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

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

describe('Milestone 4 Adversarial Stress Harness', () => {
  describe('Adversarial Path Traversal & Preview Server Security', () => {
    it('rejects lexical escape attempts with 403 Forbidden and nosniff', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-adv-lex-'),
      );
      const outsideSecret = path.join(tempDir, 'outside-secret.txt');
      await fs.writeFile(outsideSecret, 'HIGHLY_CONFIDENTIAL_OUTSIDE');

      const staticRoot = path.join(tempDir, 'static-root');
      await fs.mkdir(staticRoot, { recursive: true });
      const reportFile = path.join(staticRoot, 'report.json');
      await fs.writeFile(reportFile, JSON.stringify({ runId: 'adv-run' }));

      const handler = createServeHandler({
        reportPath: reportFile,
        staticRoot,
      });

      const attackVectors = [
        '/../../../etc/passwd',
        '/..',
        '/../',
        '/../../',
        '/./../../etc/hosts',
        '/.//../../outside-secret.txt',
        '/dir/../../../../outside-secret.txt',
        '/dir/../../../outside-secret.txt',
      ];

      for (const vector of attackVectors) {
        const res = await dispatchMockRequest(handler, vector);
        expect(res.status).toBe(403);
        expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
        expect(res.body).toBe('Forbidden');
        expect(res.body).not.toContain('HIGHLY_CONFIDENTIAL_OUTSIDE');
      }

      // Non-traversal pseudo-dots (e.g. .... is not ..) remain safely trapped in root and 404
      const nonTraversalRes = await dispatchMockRequest(handler, '/....//');
      expect(nonTraversalRes.status).toBe(404);
      expect(nonTraversalRes.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(nonTraversalRes.body).not.toContain('HIGHLY_CONFIDENTIAL_OUTSIDE');

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('rejects URL-encoded escapes with 403 Forbidden and nosniff', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-adv-url-'),
      );
      const outsideSecret = path.join(tempDir, 'outside-encoded.txt');
      await fs.writeFile(outsideSecret, 'ENCODED_CONFIDENTIAL_SECRET');

      const staticRoot = path.join(tempDir, 'static-root');
      await fs.mkdir(staticRoot, { recursive: true });
      const reportFile = path.join(staticRoot, 'report.json');
      await fs.writeFile(reportFile, JSON.stringify({ runId: 'adv-url' }));

      const handler = createServeHandler({
        reportPath: reportFile,
        staticRoot,
      });

      const encodedVectors = [
        '/%2e%2e/',
        '/%2e%2e%2f',
        '/%2e%2e',
        '/%2E%2E/',
        '/%2e%2e/%2e%2e/outside-encoded.txt',
        '/%2e%2e%2foutside-encoded.txt',
      ];

      for (const vector of encodedVectors) {
        const res = await dispatchMockRequest(handler, vector);
        expect(res.status).toBe(403);
        expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
        expect(res.body).toBe('Forbidden');
        expect(res.body).not.toContain('ENCODED_CONFIDENTIAL_SECRET');
      }

      // Literal backslash on POSIX does not escape boundary, returning 404 without leaking
      const backslashRes = await dispatchMockRequest(handler, '/%2e%2e%5c');
      expect([403, 404]).toContain(backslashRes.status);
      expect(backslashRes.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(backslashRes.body).not.toContain('ENCODED_CONFIDENTIAL_SECRET');

      // Double-encoded path stays within root or returns 404/403 without leaking
      const doubleEncodedRes = await dispatchMockRequest(
        handler,
        '/%252e%252e/%252e%252e/outside-encoded.txt',
      );
      expect([403, 404]).toContain(doubleEncodedRes.status);
      expect(doubleEncodedRes.headers['X-Content-Type-Options']).toBe(
        'nosniff',
      );
      expect(doubleEncodedRes.body).not.toContain(
        'ENCODED_CONFIDENTIAL_SECRET',
      );

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('rejects out-of-bounds symlinks while allowing valid in-bounds symlinks', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-adv-sym-'),
      );
      const outsideDir = path.join(tempDir, 'outside');
      await fs.mkdir(outsideDir, { recursive: true });
      const outsideSecret = path.join(outsideDir, 'secret.txt');
      await fs.writeFile(outsideSecret, 'SYM_CANNOT_LEAK_SECRET');

      const staticRoot = path.join(tempDir, 'static');
      await fs.mkdir(staticRoot, { recursive: true });
      const reportFile = path.join(staticRoot, 'report.json');
      await fs.writeFile(reportFile, JSON.stringify({ runId: 'adv-sym' }));

      const inBoundsFile = path.join(staticRoot, 'in-bounds.txt');
      await fs.writeFile(inBoundsFile, 'IN_BOUNDS_SAFE_DATA');

      // Create symlinks
      const outSymFile = path.join(staticRoot, 'sym_out_file.txt');
      const outSymDir = path.join(staticRoot, 'sym_out_dir');
      const inSymFile = path.join(staticRoot, 'sym_in_file.txt');
      const brokenSym = path.join(staticRoot, 'sym_broken.txt');

      await fs.symlink(outsideSecret, outSymFile);
      await fs.symlink(outsideDir, outSymDir);
      await fs.symlink(inBoundsFile, inSymFile);
      await fs.symlink(path.join(outsideDir, 'nonexistent.txt'), brokenSym);

      const handler = createServeHandler({
        reportPath: reportFile,
        staticRoot,
      });

      // 1. Out-of-bounds symlink to file -> 403 Forbidden
      const resOutFile = await dispatchMockRequest(
        handler,
        '/sym_out_file.txt',
      );
      expect(resOutFile.status).toBe(403);
      expect(resOutFile.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(resOutFile.body).toBe('Forbidden');
      expect(resOutFile.body).not.toContain('SYM_CANNOT_LEAK_SECRET');

      // 2. Out-of-bounds symlink to directory -> 403 Forbidden
      const resOutDir = await dispatchMockRequest(
        handler,
        '/sym_out_dir/secret.txt',
      );
      expect(resOutDir.status).toBe(403);
      expect(resOutDir.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(resOutDir.body).toBe('Forbidden');
      expect(resOutDir.body).not.toContain('SYM_CANNOT_LEAK_SECRET');

      // 3. In-bounds symlink -> 200 OK
      const resInFile = await dispatchMockRequest(handler, '/sym_in_file.txt');
      expect(resInFile.status).toBe(200);
      expect(resInFile.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(resInFile.body).toBe('IN_BOUNDS_SAFE_DATA');

      // 4. Broken symlink -> 404 Not Found
      const resBroken = await dispatchMockRequest(handler, '/sym_broken.txt');
      expect(resBroken.status).toBe(404);
      expect(resBroken.headers['X-Content-Type-Options']).toBe('nosniff');

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('handles malformed query strings gracefully and blocks malformed path URIs', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-adv-query-'),
      );
      const reportFile = path.join(tempDir, 'report.json');
      await fs.writeFile(reportFile, JSON.stringify({ runId: 'adv-query' }));

      const handler = createServeHandler({
        reportPath: reportFile,
        staticRoot: tempDir,
      });

      // Malformed query string does not break root route
      const resIndexQuery = await dispatchMockRequest(
        handler,
        '/index.html?param=%E0%A4%A&foo=bar#section',
      );
      expect(resIndexQuery.status).toBe(200);
      expect(resIndexQuery.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(resIndexQuery.body).toContain(
        '<diffra-viewer data-report-url="./report.json">',
      );

      // Malformed query string does not break /report.json route
      const resReportQuery = await dispatchMockRequest(
        handler,
        '/report.json?cache=%zz&invalid=%',
      );
      expect(resReportQuery.status).toBe(200);
      expect(resReportQuery.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(JSON.parse(resReportQuery.body).runId).toBe('adv-query');

      // Malformed path URIs trigger decodeURIComponent URIError -> 403 Forbidden
      const malformedPaths = [
        '/%ff',
        '/%zz',
        '/%',
        '/%%',
        '/invalid%percent/test',
      ];
      for (const badPath of malformedPaths) {
        const resBadPath = await dispatchMockRequest(handler, badPath);
        expect(resBadPath.status).toBe(403);
        expect(resBadPath.headers['X-Content-Type-Options']).toBe('nosniff');
        expect(resBadPath.body).toBe('Forbidden');
      }

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('terminates active socket connections via server.closeAllConnections() during stop()', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-adv-teardown-'),
      );
      const reportFile = path.join(tempDir, 'report.json');
      await fs.writeFile(
        reportFile,
        JSON.stringify({ runId: 'teardown-test' }),
      );

      const instance = await startServeServer({
        reportPath: reportFile,
        outputDir: tempDir,
        port: 0,
      });

      try {
        expect(instance.port).toBeGreaterThan(0);

        let socketDestroyed = false;
        const mockSocket = new Duplex({
          read() {},
          write(_chunk, _encoding, callback) {
            callback();
          },
        });
        mockSocket.destroy = () => {
          socketDestroyed = true;
          return mockSocket;
        };

        // Attach simulated connection to http.Server
        instance.server.emit('connection', mockSocket);

        // Teardown server
        await instance.stop();

        expect(socketDestroyed).toBe(true);
        expect(instance.server.listening).toBe(false);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Adversarial CLI Option Parsing & Shard Merging', () => {
    it('catches arbitrary unexpected options without crashing and exits with code 1', async () => {
      const unexpectedOptions = [
        ['--unknown-option'],
        ['-x'],
        ['--foo=bar'],
        ['-y=baz'],
        ['test', '--invalid-flag'],
        ['serve', '--unsupported-mode'],
        ['approve', '--bogus'],
        ['merge-reports', '--unknown-param'],
      ];

      for (const args of unexpectedOptions) {
        const origErr = console.error;
        const errLines: string[] = [];
        console.error = (...msgs: unknown[]) => {
          errLines.push(msgs.map(String).join(' '));
        };

        try {
          const exitCode = await main(args);
          expect(exitCode).toBe(1);
          expect(
            errLines.some((line) => line.includes('Error: Unknown option')),
          ).toBe(true);
        } finally {
          console.error = origErr;
        }
      }
    });

    it('merges multi-shard reports via combined --shard-dir flags and positional arguments', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-adv-shards-'),
      );
      const shardA = path.join(tempDir, 'shard-a');
      const shardB = path.join(tempDir, 'shard-b');
      const shardC = path.join(tempDir, 'shard-c');
      const outDir = path.join(tempDir, 'merged-output');

      await fs.mkdir(shardA, { recursive: true });
      await fs.mkdir(shardB, { recursive: true });
      await fs.mkdir(shardC, { recursive: true });

      const mkReport = (id: string, name: string) => ({
        runId: `run-${id}`,
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
            id,
            name,
            status: 'unchanged' as const,
            viewport: { width: 1024, height: 768 },
          },
        ],
      });

      await fs.writeFile(
        path.join(shardA, 'report.json'),
        JSON.stringify(mkReport('btn', 'Button')),
      );
      await fs.writeFile(
        path.join(shardB, 'report.json'),
        JSON.stringify(mkReport('modal', 'Modal')),
      );
      await fs.writeFile(
        path.join(shardC, 'report.json'),
        JSON.stringify(mkReport('table', 'Table')),
      );

      // Merge using 2 --shard-dir flags and 1 positional arg
      const exitCode = await main([
        'merge-reports',
        '--shard-dir',
        shardA,
        '--shard-dir',
        shardB,
        shardC,
        '-o',
        outDir,
      ]);

      expect(exitCode).toBe(0);

      const mergedContent = await fs.readFile(
        path.join(outDir, 'latest-report.json'),
        'utf-8',
      );
      const merged = JSON.parse(mergedContent);
      expect(merged.summary.total).toBe(3);
      expect(merged.results).toHaveLength(3);
      expect(merged.results.map((r: { id: string }) => r.id)).toEqual(
        expect.arrayContaining(['btn', 'modal', 'table']),
      );

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('returns exit code 1 with error when merge-reports is passed invalid shards', async () => {
      const origErr = console.error;
      const errLines: string[] = [];
      console.error = (...msgs: unknown[]) => {
        errLines.push(msgs.map(String).join(' '));
      };

      try {
        const exitCode = await main([
          'merge-reports',
          '/nonexistent/shard/path/1',
          '/nonexistent/shard/path/2',
        ]);
        expect(exitCode).toBe(1);
        expect(
          errLines.some((l) => l.includes('Error merging shard reports')),
        ).toBe(true);
      } finally {
        console.error = origErr;
      }
    });
  });

  describe('Adversarial Dynamic Color Compliance', () => {
    it('accurately responds to NO_COLOR and FORCE_COLOR across all specifications', () => {
      const origNo = process.env.NO_COLOR;
      const origForce = process.env.FORCE_COLOR;

      try {
        // 1. NO_COLOR="" preserves color support
        process.env.NO_COLOR = '';
        process.env.FORCE_COLOR = '1';
        expect(isColorSupported()).toBe(true);
        expect(colors.green('OK')).toContain('\x1b[32m');

        // 2. NO_COLOR="1" disables color support
        delete process.env.FORCE_COLOR;
        process.env.NO_COLOR = '1';
        expect(isColorSupported()).toBe(false);
        expect(colors.green('OK')).toBe('OK');

        // 3. NO_COLOR="true" disables color support
        process.env.NO_COLOR = 'true';
        expect(isColorSupported()).toBe(false);
        expect(colors.cyan('Val')).toBe('Val');

        // 4. NO_COLOR="0" disables color support per no-color.org (any non-empty disables)
        process.env.NO_COLOR = '0';
        expect(isColorSupported()).toBe(false);
        expect(colors.red('Fail')).toBe('Fail');

        // 5. FORCE_COLOR="0" disables color support
        delete process.env.NO_COLOR;
        process.env.FORCE_COLOR = '0';
        expect(isColorSupported()).toBe(false);
        expect(colors.bold('Bold')).toBe('Bold');

        // 6. FORCE_COLOR="false" disables color support
        process.env.FORCE_COLOR = 'false';
        expect(isColorSupported()).toBe(false);
        expect(colors.yellow('Warn')).toBe('Warn');

        // 7. FORCE_COLOR="1" enables color support
        process.env.FORCE_COLOR = '1';
        expect(isColorSupported()).toBe(true);
        expect(colors.magenta('Mag')).toContain('\x1b[35m');

        // 8. Dynamic toggle in rapid succession verifies no stale cache
        for (let i = 0; i < 5; i++) {
          process.env.FORCE_COLOR = '0';
          expect(isColorSupported()).toBe(false);
          process.env.FORCE_COLOR = '1';
          expect(isColorSupported()).toBe(true);
        }
      } finally {
        if (origNo !== undefined) process.env.NO_COLOR = origNo;
        else delete process.env.NO_COLOR;
        if (origForce !== undefined) process.env.FORCE_COLOR = origForce;
        else delete process.env.FORCE_COLOR;
      }
    });
  });
});
