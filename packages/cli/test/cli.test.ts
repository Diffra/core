import { describe, expect, it } from 'vitest';
import { main } from '../src/index.js';

describe('@diffra/cli', () => {
  it('prints version with --version flag', async () => {
    const exitCode = await main(['--version']);
    expect(exitCode).toBe(0);
  });

  it('prints help with --help flag', async () => {
    const exitCode = await main(['--help']);
    expect(exitCode).toBe(0);
  });

  it('handles unknown commands with non-zero exit code', async () => {
    const exitCode = await main(['nonexistent-command']);
    expect(exitCode).toBe(1);
  });
});
