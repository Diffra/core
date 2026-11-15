import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The file in which agent clients look for project-scoped MCP servers. */
export const MCP_CONFIG_FILE = '.mcp.json';

/** The name Diffra registers itself under in the MCP configuration. */
export const MCP_SERVER_NAME = 'diffra';

/** How an agent client starts the server. */
export const MCP_SERVER_ENTRY = {
  command: 'npx',
  args: ['diffra', 'mcp'],
} as const;

/** Where agent clients read project skills, relative to the project. */
export const SKILL_DIRECTORY = path.join(
  '.claude',
  'skills',
  'diffra-visual-review',
);

export const SKILL_FILE = 'SKILL.md';

/** The skill shipped with this package. */
const PACKAGED_SKILL = fileURLToPath(
  new URL(`../skill/${SKILL_FILE}`, import.meta.url),
);

export type SetupStatus = 'created' | 'updated' | 'unchanged' | 'kept';

/** What setup did to one file. */
export interface SetupStep {
  /** The file, relative to the project. */
  file: string;
  status: SetupStatus;
  /** Present when a file was kept: why, and how to replace it. */
  note?: string;
}

export interface SetupOptions {
  cwd: string;
  /** Install the skill that describes the review loop. Default `true`. */
  skill?: boolean;
  /** Replace a registration or a skill that differs from the packaged one. */
  force?: boolean;
}

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

async function writeFile(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

function sameEntry(value: unknown): boolean {
  return JSON.stringify(value) === JSON.stringify(MCP_SERVER_ENTRY);
}

async function registerServer(cwd: string, force: boolean): Promise<SetupStep> {
  const file = path.join(cwd, MCP_CONFIG_FILE);
  const existing = await readIfExists(file);

  let config: { mcpServers?: Record<string, unknown> } = {};
  if (existing !== undefined) {
    try {
      config = JSON.parse(existing);
    } catch {
      throw new Error(
        `${MCP_CONFIG_FILE} is not valid JSON. Fix it, or delete it and run setup again.`,
      );
    }
    if (
      config === null ||
      typeof config !== 'object' ||
      Array.isArray(config)
    ) {
      throw new Error(`${MCP_CONFIG_FILE} must hold a JSON object.`);
    }
  }

  const servers = config.mcpServers ?? {};
  const current = servers[MCP_SERVER_NAME];
  if (current !== undefined && sameEntry(current)) {
    return { file: MCP_CONFIG_FILE, status: 'unchanged' };
  }
  if (current !== undefined && !force) {
    return {
      file: MCP_CONFIG_FILE,
      status: 'kept',
      note: `A "${MCP_SERVER_NAME}" server is already registered differently. Use --force to replace it.`,
    };
  }

  await writeFile(
    file,
    `${JSON.stringify(
      {
        ...config,
        mcpServers: { ...servers, [MCP_SERVER_NAME]: MCP_SERVER_ENTRY },
      },
      null,
      2,
    )}\n`,
  );
  return {
    file: MCP_CONFIG_FILE,
    status: existing === undefined ? 'created' : 'updated',
  };
}

async function installSkill(cwd: string, force: boolean): Promise<SetupStep> {
  const relative = path.join(SKILL_DIRECTORY, SKILL_FILE);
  const target = path.join(cwd, relative);
  const packaged = await fs.readFile(PACKAGED_SKILL, 'utf-8');
  const existing = await readIfExists(target);

  if (existing === packaged) return { file: relative, status: 'unchanged' };
  if (existing !== undefined && !force) {
    return {
      file: relative,
      status: 'kept',
      note: 'The skill differs from the packaged one. Use --force to replace it.',
    };
  }
  await writeFile(target, packaged);
  return {
    file: relative,
    status: existing === undefined ? 'created' : 'updated',
  };
}

/**
 * Prepares a project for agents: registers the MCP server and installs the
 * skill that describes the review loop. Existing configuration is merged,
 * never overwritten, unless asked for.
 */
export async function setupAgent(options: SetupOptions): Promise<SetupStep[]> {
  const force = options.force ?? false;
  const steps = [await registerServer(options.cwd, force)];
  if (options.skill ?? true) {
    steps.push(await installSkill(options.cwd, force));
  }
  return steps;
}
