import { parseArgs } from 'node:util';
import { startMcpServer } from './index.js';

const HELP = `diffra-mcp: serve Diffra to AI agents over the Model Context Protocol

Usage:
  diffra-mcp [options]

Options:
  -c, --config <path>   Path to the Diffra configuration file
  -r, --report <where>  Read a published review bundle (address or folder)
                        instead of this project. Read-only.
  -h, --help            Show this help
`;

export const MCP_OPTIONS = {
  config: { type: 'string', short: 'c' },
  report: { type: 'string', short: 'r' },
  help: { type: 'boolean', short: 'h' },
} as const;

export async function main(args = process.argv.slice(2)): Promise<number> {
  const { values } = parseArgs({ args, options: MCP_OPTIONS });
  if (values.help) {
    console.error(HELP);
    return 0;
  }
  await startMcpServer({ configFile: values.config, report: values.report });
  return 0;
}
