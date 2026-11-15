import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { ToolDefinition } from '../src/protocol.js';
import { McpServer, serveStdio } from '../src/server.js';

const echo: ToolDefinition = {
  name: 'echo',
  description: 'Returns its text.',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
  handler: async (args) => ({
    content: [{ type: 'text', text: String(args.text) }],
  }),
};

const broken: ToolDefinition = {
  name: 'broken',
  description: 'Always throws.',
  inputSchema: { type: 'object' },
  handler: async () => {
    throw new Error('it did not work');
  },
};

function server() {
  return new McpServer(
    { name: 'test', version: '1.2.3', instructions: 'Hi.' },
    [echo, broken],
  );
}

const request = (method: string, params?: unknown, id = 1) => ({
  jsonrpc: '2.0',
  id,
  method,
  params,
});

describe('McpServer', () => {
  it('answers initialize with the version the client asked for', async () => {
    const response = await server().handle(
      request('initialize', { protocolVersion: '2024-11-05' }),
    );
    expect(response?.result).toMatchObject({
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'test', version: '1.2.3' },
      instructions: 'Hi.',
      capabilities: { tools: {}, resources: {} },
    });
  });

  it('offers its newest version when the client asks for an unknown one', async () => {
    const response = await server().handle(
      request('initialize', { protocolVersion: '1999-01-01' }),
    );
    expect(response?.result).toMatchObject({ protocolVersion: '2025-06-18' });
  });

  it('lists tools without their handlers', async () => {
    const response = await server().handle(request('tools/list'));
    expect(response?.result).toEqual({
      tools: [
        {
          name: 'echo',
          description: echo.description,
          inputSchema: echo.inputSchema,
        },
        {
          name: 'broken',
          description: broken.description,
          inputSchema: broken.inputSchema,
        },
      ],
    });
  });

  it('calls a tool', async () => {
    const response = await server().handle(
      request('tools/call', { name: 'echo', arguments: { text: 'hello' } }),
    );
    expect(response?.result).toEqual({
      content: [{ type: 'text', text: 'hello' }],
    });
  });

  it('turns a throwing tool into an error result the agent can read', async () => {
    const response = await server().handle(
      request('tools/call', { name: 'broken' }),
    );
    expect(response?.error).toBeUndefined();
    expect(response?.result).toEqual({
      content: [{ type: 'text', text: 'it did not work' }],
      isError: true,
    });
  });

  it('rejects an unknown tool and an unknown method', async () => {
    const tool = await server().handle(request('tools/call', { name: 'nope' }));
    expect(tool?.error?.code).toBe(-32602);
    const method = await server().handle(request('nothing/here'));
    expect(method?.error?.code).toBe(-32601);
  });

  it('sends no response to a notification', async () => {
    const response = await server().handle({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(response).toBeUndefined();
  });

  it('rejects a message that is not a JSON-RPC request', async () => {
    const response = await server().handle({ hello: 'world' });
    expect(response?.error?.code).toBe(-32600);
  });
});

describe('serveStdio', () => {
  it('answers each line with one line and reports a parse error', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (chunk) => chunks.push(String(chunk)));

    const done = serveStdio(server(), input, output);
    input.write(`${JSON.stringify(request('ping', undefined, 7))}\n`);
    input.write('this is not json\n');
    input.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
    );
    input.end();
    await done;

    const lines = chunks
      .join('')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(lines).toHaveLength(2);
    expect(lines).toContainEqual({ jsonrpc: '2.0', id: 7, result: {} });
    expect(lines).toContainEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    });
  });
});
