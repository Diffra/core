import { EventEmitter } from 'node:events';
import http from 'node:http';
import type { Socket } from 'node:net';
import { describe, expect, it } from 'vitest';
import { main } from '../src/index.js';

function _dispatchMockRequest(
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

describe('merge-reports with invalid input', () => {
  describe('shard inputs', () => {
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
});
