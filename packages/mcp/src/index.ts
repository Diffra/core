import path from 'node:path';
import {
  type ApprovalPolicy,
  addIntent,
  approveBaselines,
  DEFAULT_INTENT_FILE,
  loadConfig,
  proveSnapshot,
  resolveOutputDir,
  runVisualRegression,
  suggestFixes,
  verifyRun,
} from '@diffra/core';
import { McpServer, serveStdio } from './server.js';
import { LocalRunSource, openBundle, type ReviewSource } from './source.js';
import { type Actions, createResources, createTools } from './tools.js';

export * from './protocol.js';
export { McpServer, serveStdio } from './server.js';
export * from './setup.js';
export * from './source.js';
export * from './tools.js';

export const SERVER_NAME = 'diffra';
export const SERVER_VERSION = '0.1.0';

/** Sent to the agent when it connects, so it knows how to use the tools. */
export const SERVER_INSTRUCTIONS = [
  'Diffra compares screenshots of a user interface with approved baselines.',
  'Start with diffra_status, then diffra_list_changes to see what needs a decision.',
  'Use diffra_view with a region to look at one changed area instead of a whole screenshot.',
  'Before changing the interface, declare what you will change with diffra_declare_intent, so that later runs can tell intended changes from collateral ones.',
  'Use diffra_explain to see what in the page caused a change, and diffra_prove to test that cause in the live page. Once a cause is proven, diffra_suggest_fix says how to undo it. After you change something, diffra_verify says which open changes are resolved.',
  'Approve a snapshot with diffra_approve only when its change is intended, and always list the ids.',
].join(' ');

export interface DiffraServerOptions {
  source: ReviewSource;
  actions?: Actions;
  approvalPolicy?: ApprovalPolicy;
}

/** Builds the server for a source of runs. Transport is chosen by the caller. */
export function createDiffraServer(options: DiffraServerOptions): McpServer {
  return new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      instructions: SERVER_INSTRUCTIONS,
    },
    createTools(options),
    createResources(options),
  );
}

export interface StartOptions {
  cwd?: string;
  configFile?: string;
  /** A published review bundle, as an address or a folder. Makes the server read-only. */
  report?: string;
}

/**
 * Serves MCP over this process's standard input and output until the client
 * disconnects. Anything printed to standard output would corrupt the
 * protocol, so ordinary logging is redirected to standard error.
 */
export async function startMcpServer(
  options: StartOptions = {},
): Promise<void> {
  console.log = console.error;
  console.info = console.error;
  console.debug = console.error;

  if (options.report) {
    const server = createDiffraServer({ source: openBundle(options.report) });
    await serveStdio(server, process.stdin, process.stdout);
    return;
  }

  const cwd = path.resolve(options.cwd ?? process.cwd());
  const { configFile } = options;
  const config = await loadConfig(cwd, undefined, configFile);
  const server = createDiffraServer({
    source: new LocalRunSource(resolveOutputDir(config, cwd)),
    approvalPolicy: config.agent?.autoApprove,
    actions: {
      run: ({ filter }) =>
        runVisualRegression({
          cwd,
          configFile,
          config: filter ? { runner: { filter } } : undefined,
        }),
      approve: ({ ids, rationale, report }) =>
        approveBaselines({
          cwd,
          configFile,
          ids,
          report,
          provenance: { actor: 'agent', rationale },
        }),
      prove: (options) => proveSnapshot({ cwd, configFile, ...options }),
      suggestFixes: (explanation) => suggestFixes({ explanation, cwd }),
      verify: ({ filter, affected }) =>
        verifyRun({
          cwd,
          configFile,
          config: filter ? { runner: { filter } } : undefined,
          affected,
        }),
      declareIntent: (input) =>
        addIntent(
          path.resolve(cwd, config.agent?.intentFile ?? DEFAULT_INTENT_FILE),
          input,
        ),
    },
  });
  await serveStdio(server, process.stdin, process.stdout);
}
