import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';

describe('loadConfig overrides', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-loader-'));
    file = path.join(dir, 'diffra.json');
    await fs.writeFile(
      file,
      JSON.stringify({
        runner: {
          concurrency: 2,
          baselineBranch: 'origin/trunk',
          projects: [{ name: 'webkit', browser: 'webkit' }],
        },
        snapshot: { delay: 250, diffThreshold: 0.1 },
      }),
    );
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('keeps the runner settings of the file when one is overridden', async () => {
    const config = await loadConfig(
      dir,
      { runner: { filter: 'button' } },
      file,
    );
    expect(config.runner).toMatchObject({
      filter: 'button',
      concurrency: 2,
      baselineBranch: 'origin/trunk',
      projects: [{ name: 'webkit', browser: 'webkit' }],
    });
  });

  it('keeps the snapshot settings of the file when one is overridden', async () => {
    const config = await loadConfig(dir, { snapshot: { delay: 500 } }, file);
    expect(config.snapshot).toMatchObject({ delay: 500, diffThreshold: 0.1 });
  });

  it('lets an override win over the same setting in the file', async () => {
    const config = await loadConfig(dir, { runner: { concurrency: 8 } }, file);
    expect(config.runner?.concurrency).toBe(8);
  });
});
