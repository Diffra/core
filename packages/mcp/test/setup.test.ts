import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MCP_CONFIG_FILE,
  MCP_SERVER_ENTRY,
  MCP_SERVER_NAME,
  SKILL_DIRECTORY,
  SKILL_FILE,
  setupAgent,
} from '../src/setup.js';

describe('setupAgent', () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-setup-'));
  });
  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  const readConfig = async () =>
    JSON.parse(await fs.readFile(path.join(cwd, MCP_CONFIG_FILE), 'utf-8'));

  it('registers the server and installs the skill in a bare project', async () => {
    const steps = await setupAgent({ cwd });
    expect(steps.map((s) => s.status)).toEqual(['created', 'created']);
    expect((await readConfig()).mcpServers[MCP_SERVER_NAME]).toEqual(
      MCP_SERVER_ENTRY,
    );
    const skill = await fs.readFile(
      path.join(cwd, SKILL_DIRECTORY, SKILL_FILE),
      'utf-8',
    );
    expect(skill).toContain('diffra_declare_intent');
  });

  it('merges into an existing configuration without losing other servers', async () => {
    await fs.writeFile(
      path.join(cwd, MCP_CONFIG_FILE),
      JSON.stringify({ mcpServers: { other: { command: 'x' } }, extra: 1 }),
    );
    const [config] = await setupAgent({ cwd, skill: false });
    expect(config?.status).toBe('updated');
    const written = await readConfig();
    expect(written.mcpServers.other).toEqual({ command: 'x' });
    expect(written.extra).toBe(1);
    expect(written.mcpServers[MCP_SERVER_NAME]).toEqual(MCP_SERVER_ENTRY);
  });

  it('is idempotent', async () => {
    await setupAgent({ cwd });
    const steps = await setupAgent({ cwd });
    expect(steps.map((s) => s.status)).toEqual(['unchanged', 'unchanged']);
  });

  it('keeps a different registration unless forced', async () => {
    await fs.writeFile(
      path.join(cwd, MCP_CONFIG_FILE),
      JSON.stringify({
        mcpServers: { [MCP_SERVER_NAME]: { command: 'mine' } },
      }),
    );
    const [kept] = await setupAgent({ cwd, skill: false });
    expect(kept?.status).toBe('kept');
    expect(kept?.note).toContain('--force');
    expect((await readConfig()).mcpServers[MCP_SERVER_NAME].command).toBe(
      'mine',
    );

    const [forced] = await setupAgent({ cwd, skill: false, force: true });
    expect(forced?.status).toBe('updated');
    expect((await readConfig()).mcpServers[MCP_SERVER_NAME]).toEqual(
      MCP_SERVER_ENTRY,
    );
  });

  it('keeps an edited skill unless forced', async () => {
    await setupAgent({ cwd });
    const file = path.join(cwd, SKILL_DIRECTORY, SKILL_FILE);
    await fs.writeFile(file, 'my own instructions');
    const steps = await setupAgent({ cwd });
    expect(steps[1]?.status).toBe('kept');
    expect(await fs.readFile(file, 'utf-8')).toBe('my own instructions');
    const forced = await setupAgent({ cwd, force: true });
    expect(forced[1]?.status).toBe('updated');
  });

  it('skips the skill on request', async () => {
    const steps = await setupAgent({ cwd, skill: false });
    expect(steps).toHaveLength(1);
    await expect(fs.access(path.join(cwd, SKILL_DIRECTORY))).rejects.toThrow();
  });

  it('refuses to overwrite a configuration that is not valid JSON', async () => {
    const file = path.join(cwd, MCP_CONFIG_FILE);
    await fs.writeFile(file, '{ not json');
    await expect(setupAgent({ cwd })).rejects.toThrow('not valid JSON');
    expect(await fs.readFile(file, 'utf-8')).toBe('{ not json');
  });
});
