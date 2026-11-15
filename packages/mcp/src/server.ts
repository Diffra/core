import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import {
  ERROR_CODES,
  JSONRPC_VERSION,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
  ProtocolError,
  type ResourceDefinition,
  SUPPORTED_PROTOCOL_VERSIONS,
  type ToolDefinition,
} from './protocol.js';

export interface ServerInfo {
  name: string;
  version: string;
  /** Plain-language guidance sent to the agent when it connects. */
  instructions?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failure(
  id: JsonRpcId,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: JSONRPC_VERSION, id, error: { code, message } };
}

/**
 * A Model Context Protocol server: it answers requests with tools and
 * resources and has no opinion about how the messages travel.
 */
export class McpServer {
  private readonly info: ServerInfo;
  private readonly tools: Map<string, ToolDefinition>;
  private readonly resources: Map<string, ResourceDefinition>;

  constructor(
    info: ServerInfo,
    tools: ToolDefinition[],
    resources: ResourceDefinition[] = [],
  ) {
    this.info = info;
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
    this.resources = new Map(resources.map((r) => [r.uri, r]));
  }

  /** Answers one decoded message, or returns nothing for a notification. */
  async handle(message: unknown): Promise<JsonRpcResponse | undefined> {
    if (
      !isRecord(message) ||
      message.jsonrpc !== JSONRPC_VERSION ||
      typeof message.method !== 'string'
    ) {
      const id = isRecord(message) ? (message.id as JsonRpcId) : null;
      return failure(id ?? null, ERROR_CODES.invalidRequest, 'Invalid request');
    }

    const request = message as unknown as JsonRpcRequest;
    const isNotification = request.id === undefined;
    try {
      const result = await this.dispatch(request.method, request.params);
      return isNotification
        ? undefined
        : { jsonrpc: JSONRPC_VERSION, id: request.id ?? null, result };
    } catch (err) {
      if (isNotification) return undefined;
      const id = request.id ?? null;
      if (err instanceof ProtocolError) {
        return failure(id, err.code, err.message);
      }
      return failure(
        id,
        ERROR_CODES.internal,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private async dispatch(method: string, params: unknown): Promise<unknown> {
    const args = isRecord(params) ? params : {};
    switch (method) {
      case 'initialize':
        return this.initialize(args);
      case 'ping':
        return {};
      case 'tools/list':
        return {
          tools: [...this.tools.values()].map(
            ({ name, description, inputSchema }) => ({
              name,
              description,
              inputSchema,
            }),
          ),
        };
      case 'tools/call':
        return this.callTool(args);
      case 'resources/list':
        return {
          resources: [...this.resources.values()].map(
            ({ uri, name, description, mimeType }) => ({
              uri,
              name,
              description,
              mimeType,
            }),
          ),
        };
      case 'resources/read':
        return this.readResource(args);
      default:
        // Notifications such as notifications/initialized need no work.
        if (method.startsWith('notifications/')) return undefined;
        throw new ProtocolError(
          ERROR_CODES.methodNotFound,
          `Method not found: ${method}`,
        );
    }
  }

  private initialize(params: Record<string, unknown>) {
    const requested = params.protocolVersion;
    const protocolVersion =
      SUPPORTED_PROTOCOL_VERSIONS.find((v) => v === requested) ??
      SUPPORTED_PROTOCOL_VERSIONS[0];
    return {
      protocolVersion,
      capabilities: { tools: {}, resources: {} },
      serverInfo: { name: this.info.name, version: this.info.version },
      ...(this.info.instructions
        ? { instructions: this.info.instructions }
        : {}),
    };
  }

  private async callTool(params: Record<string, unknown>) {
    const name = params.name;
    const tool = typeof name === 'string' ? this.tools.get(name) : undefined;
    if (!tool) {
      throw new ProtocolError(
        ERROR_CODES.invalidParams,
        `Unknown tool: ${String(name)}`,
      );
    }
    const args = isRecord(params.arguments) ? params.arguments : {};
    try {
      return await tool.handler(args);
    } catch (err) {
      if (err instanceof ProtocolError) throw err;
      // The agent can read this and try again, so it is a result, not a fault.
      return {
        content: [
          {
            type: 'text',
            text: err instanceof Error ? err.message : String(err),
          },
        ],
        isError: true,
      };
    }
  }

  private async readResource(params: Record<string, unknown>) {
    const uri = params.uri;
    const resource =
      typeof uri === 'string' ? this.resources.get(uri) : undefined;
    if (!resource) {
      throw new ProtocolError(
        ERROR_CODES.invalidParams,
        `Unknown resource: ${String(uri)}`,
      );
    }
    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType,
          text: await resource.read(),
        },
      ],
    };
  }
}

/**
 * Serves a server over newline-delimited JSON, one message per line, which is
 * how MCP clients talk to a local process. Resolves when the input ends.
 * Nothing but protocol messages may be written to the output.
 */
export async function serveStdio(
  server: McpServer,
  input: Readable,
  output: Writable,
): Promise<void> {
  const send = (response: JsonRpcResponse) => {
    output.write(`${JSON.stringify(response)}\n`);
  };

  const pending = new Set<Promise<void>>();
  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      send(failure(null, ERROR_CODES.parse, 'Parse error'));
      continue;
    }
    // Requests run side by side, so a slow run does not block a status call.
    const work = server.handle(message).then((response) => {
      if (response) send(response);
    });
    pending.add(work);
    void work.finally(() => pending.delete(work));
  }
  await Promise.all(pending);
}
