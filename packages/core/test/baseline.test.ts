import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getGitInfo, parseGitRemoteUrl } from '../src/git/baseline.js';

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

describe('Git Baseline Resolution', () => {
  describe('parseGitRemoteUrl', () => {
    it('parses SSH git remotes', () => {
      expect(parseGitRemoteUrl('git@github.com:Diffra/core.git')).toBe(
        'https://github.com/Diffra/core',
      );
    });

    it('parses HTTPS git remotes', () => {
      expect(parseGitRemoteUrl('https://github.com/Diffra/core.git')).toBe(
        'https://github.com/Diffra/core',
      );
      expect(parseGitRemoteUrl('https://gitlab.com/org/repo')).toBe(
        'https://gitlab.com/org/repo',
      );
    });

    it('handles empty or invalid inputs', () => {
      expect(parseGitRemoteUrl('')).toBeUndefined();
    });
  });

  describe('getGitInfo dynamic DAG discovery', () => {
    let tmpDir: string;
    const originalEnv = { ...process.env };

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-git-test-'));
      // Initialize a fresh git repo
      await runGit(['init', '-b', 'main'], tmpDir);
      await runGit(['config', 'user.name', 'Test User'], tmpDir);
      await runGit(['config', 'user.email', 'test@diffra.dev'], tmpDir);

      // Initial commit on main
      await fs.writeFile(path.join(tmpDir, 'file.txt'), 'initial commit\n');
      await runGit(['add', '.'], tmpDir);
      await runGit(['commit', '-m', 'initial commit on main'], tmpDir);
    });

    afterEach(async () => {
      process.env = { ...originalEnv };
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('resolves explicit targetBaselineBranch when provided', async () => {
      // Create dev branch with 1 commit
      await runGit(['checkout', '-b', 'dev'], tmpDir);
      await fs.writeFile(path.join(tmpDir, 'file.txt'), 'commit on dev\n');
      await runGit(['commit', '-am', 'dev commit'], tmpDir);

      // Create feature branch off dev
      await runGit(['checkout', '-b', 'feature/test'], tmpDir);
      await fs.writeFile(path.join(tmpDir, 'file.txt'), 'feature commit\n');
      await runGit(['commit', '-am', 'feature commit'], tmpDir);

      const info = await getGitInfo('dev', tmpDir);
      expect(info.branch).toBe('feature/test');
      expect(info.baselineBranch).toBe('dev');
      expect(info.baselineCommit).toBeDefined();
      expect(info.baselineCommit).not.toBe(info.commit);
    });

    it('resolves CI target branch from GITHUB_BASE_REF automatically without configuration', async () => {
      // Create dev branch with 1 commit
      await runGit(['checkout', '-b', 'dev'], tmpDir);
      await fs.writeFile(path.join(tmpDir, 'file.txt'), 'commit on dev\n');
      await runGit(['commit', '-am', 'dev commit'], tmpDir);

      // Create feature branch off dev
      await runGit(['checkout', '-b', 'feature/test1234'], tmpDir);
      await fs.writeFile(path.join(tmpDir, 'file.txt'), 'feature commit\n');
      await runGit(['commit', '-am', 'feature commit'], tmpDir);

      process.env.GITHUB_BASE_REF = 'dev';

      const info = await getGitInfo(undefined, tmpDir);
      expect(info.branch).toBe('feature/test1234');
      expect(info.baselineBranch).toBe('dev');
      expect(info.baselineCommit).toBeDefined();
    });

    it('resolves topological nearest-neighbor parent branch without hardcoded branch names', async () => {
      // main has commit 1
      // dev branches off main, adds commit 2
      await runGit(['checkout', '-b', 'dev'], tmpDir);
      await fs.writeFile(path.join(tmpDir, 'dev.txt'), 'dev commit\n');
      await runGit(['add', '.'], tmpDir);
      await runGit(['commit', '-m', 'commit on dev'], tmpDir);

      // feature branches off dev, adds commit 3
      await runGit(['checkout', '-b', 'feature/un-opinionated'], tmpDir);
      await fs.writeFile(path.join(tmpDir, 'feature.txt'), 'feature commit\n');
      await runGit(['add', '.'], tmpDir);
      await runGit(['commit', '-m', 'commit on feature'], tmpDir);

      // Call getGitInfo with zero arguments and no CI environment variables
      delete process.env.GITHUB_BASE_REF;
      delete process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME;

      const info = await getGitInfo(undefined, tmpDir);
      expect(info.branch).toBe('feature/un-opinionated');
      // Nearest topological neighbor is 'dev' (distance 1 commit vs distance 2 commits from main)
      expect(info.baselineBranch).toBe('dev');
      expect(info.baselineCommit).toBeDefined();
    });

    it('handles non-git directories gracefully', async () => {
      const nonGitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-non-git-'));
      try {
        const info = await getGitInfo(undefined, nonGitDir);
        expect(info.commit).toBe('uncommitted');
        expect(info.baselineCommit).toBe('uncommitted');
      } finally {
        await fs.rm(nonGitDir, { recursive: true, force: true });
      }
    });
  });
});
