import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getGitInfo, parseGitRemoteUrl } from '../../src/index.js';

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

describe('git baseline resolution', () => {
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

    it('drops credentials embedded in a remote', () => {
      expect(
        parseGitRemoteUrl(
          'https://gitlab-ci-token:glcbt-secret@gitlab.com/org/repo.git',
        ),
      ).toBe('https://gitlab.com/org/repo');
      expect(
        parseGitRemoteUrl('https://x-access-token:ghs_secret@github.com/o/r'),
      ).toBe('https://github.com/o/r');
      expect(parseGitRemoteUrl('https://token@host.example/a/b/')).toBe(
        'https://host.example/a/b',
      );
    });

    it('keeps a port and a nested group path', () => {
      expect(
        parseGitRemoteUrl('https://git.example.com:8443/group/sub/repo.git'),
      ).toBe('https://git.example.com:8443/group/sub/repo');
    });

    it('handles empty or invalid inputs', () => {
      expect(parseGitRemoteUrl('')).toBeUndefined();
      expect(parseGitRemoteUrl('https://')).toBeUndefined();
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
      const nonGitDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-non-git-'),
      );
      try {
        const info = await getGitInfo(undefined, nonGitDir);
        expect(info.commit).toBe('uncommitted');
        expect(info.baselineCommit).toBe('uncommitted');
      } finally {
        await fs.rm(nonGitDir, { recursive: true, force: true });
      }
    });
  });

  it('getGitInfo safely resolves in non-existent directory without throwing', async () => {
    const nonExistent = path.join(os.tmpdir(), `non-existent-${Date.now()}`);
    const info = await getGitInfo(undefined, nonExistent);
    expect(info.commit).toBe('uncommitted');
    expect(info.baselineCommit).toBe('uncommitted');
  });

  describe('Git Baseline Resolver', () => {
    let tmpDir: string;
    const originalEnv = { ...process.env };

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-git-m5-stress-'),
      );
      await runGit(['init', '-b', 'main'], tmpDir);
      await runGit(['config', 'user.name', 'Test Author'], tmpDir);
      await runGit(['config', 'user.email', 'author@example.invalid'], tmpDir);

      // Commit 1 on main
      await fs.writeFile(path.join(tmpDir, 'root.txt'), 'root commit 1\n');
      await runGit(['add', '.'], tmpDir);
      await runGit(['commit', '-m', 'commit 1 on main'], tmpDir);
    });

    afterEach(async () => {
      process.env = { ...originalEnv };
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('resolves baseline commit and branch correctly in detached HEAD state', async () => {
      // Create commit 2 on main
      await fs.writeFile(path.join(tmpDir, 'root.txt'), 'root commit 2\n');
      await runGit(['commit', '-am', 'commit 2 on main'], tmpDir);
      const commit2Sha = await runGit(['rev-parse', 'HEAD'], tmpDir);

      // Create branch feature-alpha with commit 3
      await runGit(['checkout', '-b', 'feature-alpha'], tmpDir);
      await fs.writeFile(path.join(tmpDir, 'alpha.txt'), 'alpha content\n');
      await runGit(['add', '.'], tmpDir);
      await runGit(['commit', '-m', 'commit 3 on feature-alpha'], tmpDir);

      // Detach HEAD to commit 2
      await runGit(['checkout', commit2Sha], tmpDir);

      // Clear CI environment variables
      delete process.env.GITHUB_HEAD_REF;
      delete process.env.GITHUB_REF_NAME;
      delete process.env.CI_COMMIT_REF_NAME;
      delete process.env.GITHUB_BASE_REF;

      const gitInfo = await getGitInfo(undefined, tmpDir);

      // In detached HEAD, branch should default to 'HEAD'
      expect(gitInfo.branch).toBe('HEAD');
      expect(gitInfo.commit).toBe(commit2Sha);
      expect(gitInfo.baselineCommit).toBeDefined();
      expect(gitInfo.baselineCommit.length).toBeGreaterThan(0);
    });

    it('falls back safely when target baseline branch does not exist', async () => {
      const nonExistentBranch = 'non-existent-baseline-branch-xyz';

      // Call getGitInfo requesting a branch that does not exist
      const gitInfo = await getGitInfo(nonExistentBranch, tmpDir);

      // Must not throw; must fall back to existing DAG reference or current commit
      expect(gitInfo.commit).toBeDefined();
      expect(gitInfo.baselineCommit).toBeDefined();
      expect(gitInfo.baselineCommit.length).toBeGreaterThan(0);
    });

    it('correctly resolves ancestor in multi-tier branching hierarchy', async () => {
      // main: Commit A
      const commitASha = await runGit(['rev-parse', 'HEAD'], tmpDir);

      // develop: branches from main, adds Commit B
      await runGit(['checkout', '-b', 'develop'], tmpDir);
      await fs.writeFile(path.join(tmpDir, 'develop.txt'), 'develop work\n');
      await runGit(['add', '.'], tmpDir);
      await runGit(['commit', '-m', 'commit B on develop'], tmpDir);
      const commitBSha = await runGit(['rev-parse', 'HEAD'], tmpDir);

      // feature/nested: branches from develop, adds Commit C
      await runGit(['checkout', '-b', 'feature/nested'], tmpDir);
      await fs.writeFile(
        path.join(tmpDir, 'nested.txt'),
        'nested feature work\n',
      );
      await runGit(['add', '.'], tmpDir);
      await runGit(['commit', '-m', 'commit C on feature/nested'], tmpDir);

      // 1. Explicit baseline 'main' -> baseline commit MUST be Commit A
      const mainInfo = await getGitInfo('main', tmpDir);
      expect(mainInfo.baselineBranch).toBe('main');
      expect(mainInfo.baselineCommit).toBe(commitASha);

      // 2. Explicit baseline 'develop' -> baseline commit MUST be Commit B
      const devInfo = await getGitInfo('develop', tmpDir);
      expect(devInfo.baselineBranch).toBe('develop');
      expect(devInfo.baselineCommit).toBe(commitBSha);

      // 3. Dynamic topology discovery (zero config) -> nearest neighbor MUST be 'develop' (distance 1)
      delete process.env.GITHUB_BASE_REF;
      const dynamicInfo = await getGitInfo(undefined, tmpDir);
      expect(dynamicInfo.baselineBranch).toBe('develop');
      expect(dynamicInfo.baselineCommit).toBe(commitBSha);
    });

    it('handles remote URL parsing across diverse formats', () => {
      expect(parseGitRemoteUrl('git@github.com:Diffra/engine-repo.git')).toBe(
        'https://github.com/Diffra/engine-repo',
      );

      expect(
        parseGitRemoteUrl('https://gitlab.example.org/org/core-system.git'),
      ).toBe('https://gitlab.example.org/org/core-system');

      expect(parseGitRemoteUrl('http://git.internal.corp/team/project')).toBe(
        'https://git.internal.corp/team/project',
      );

      expect(parseGitRemoteUrl('')).toBeUndefined();
      expect(parseGitRemoteUrl('not-a-valid-url')).toBeUndefined();
    });
  });
});
