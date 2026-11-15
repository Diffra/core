import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/index.js';

describe('diffra intent', () => {
  let dir: string;
  let previous: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(async () => {
    previous = process.cwd();
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-cli-intent-'));
    process.chdir(dir);
    stdout = [];
    stderr = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => {
      stdout.push(a.join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...a) => {
      stderr.push(a.join(' '));
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.chdir(previous);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('declares, lists and clears intents', async () => {
    expect(
      await main([
        'intent',
        'add',
        'Roomier',
        'buttons',
        '--source',
        'src/button.css',
        '--target',
        'button',
        '--json',
      ]),
    ).toBe(0);
    const added = JSON.parse(stdout.join('\n'));
    expect(added).toMatchObject({
      description: 'Roomier buttons',
      sources: ['src/button.css'],
      targets: ['button'],
      author: 'human',
    });

    stdout = [];
    expect(await main(['intent', 'list', '--json'])).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toHaveLength(1);

    stdout = [];
    expect(await main(['intent', 'clear', '--json'])).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toEqual({ removed: 1 });
    stdout = [];
    expect(await main(['intent', 'list', '--json'])).toBe(0);
    expect(JSON.parse(stdout.join('\n'))).toEqual([]);
  });

  it('refuses an intent that covers nothing in particular', async () => {
    expect(await main(['intent', 'add', 'Everything'])).toBe(1);
    expect(stderr.join('\n')).toMatch(
      /at least one of targets, sources or selectors/,
    );
  });

  it('refuses an unknown subcommand and a bad gate', async () => {
    expect(await main(['intent', 'frobnicate'])).toBe(1);
    expect(stderr.join('\n')).toMatch(/Unknown intent command/);
    expect(await main(['--gate', 'sometimes'])).toBe(1);
    expect(stderr.join('\n')).toMatch(/--gate must be "any" or "collateral"/);
  });
});
