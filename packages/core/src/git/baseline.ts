import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitInfo {
  branch: string;
  commit: string;
  baselineCommit: string;
  repositoryUrl?: string;
}

/**
 * Runs a git command safely in the specified cwd.
 */
async function runGit(args: string[], cwd = process.cwd()): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd });
    return stdout.trim();
  } catch {
    return '';
  }
}

/**
 * Converts SSH or HTTPS remote URLs into a standard HTTPS web URL.
 */
export function parseGitRemoteUrl(rawUrl: string): string | undefined {
  if (!rawUrl) return undefined;

  // Handle git@host:owner/repo.git
  const sshMatch = rawUrl.match(/^git@([^:]+):([^/]+)\/(.+?)(\.git)?$/);
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}/${sshMatch[3]}`;
  }

  // Handle https://host/owner/repo.git
  const httpMatch = rawUrl.match(
    /^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(\.git)?$/,
  );
  if (httpMatch) {
    return `https://${httpMatch[1]}/${httpMatch[2]}/${httpMatch[3]}`;
  }

  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl.replace(/\.git$/, '');
  }

  return undefined;
}

/**
 * Discovers the current git commit, branch, and merge-base baseline commit relative to the target branch.
 */
export async function getGitInfo(
  targetBaselineBranch = 'origin/main',
  cwd = process.cwd(),
): Promise<GitInfo> {
  // Get current commit SHA
  let commit = await runGit(['rev-parse', 'HEAD'], cwd);
  if (!commit) {
    commit = 'uncommitted';
  }

  // Get current branch
  let branch = await runGit(['branch', '--show-current'], cwd);
  if (!branch) {
    branch =
      process.env.GITHUB_HEAD_REF ||
      process.env.GITHUB_REF_NAME ||
      process.env.CI_COMMIT_REF_NAME ||
      'HEAD';
  }

  // Discover repository URL
  let repositoryUrl: string | undefined;
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY) {
    repositoryUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
  } else {
    const remoteUrl = await runGit(['config', '--get', 'remote.origin.url'], cwd);
    repositoryUrl = parseGitRemoteUrl(remoteUrl);
  }

  // Candidate branches to attempt merge-base resolution
  const candidateBranches: string[] = [];
  if (targetBaselineBranch) {
    candidateBranches.push(targetBaselineBranch);
    if (targetBaselineBranch.startsWith('origin/')) {
      candidateBranches.push(targetBaselineBranch.replace(/^origin\//, ''));
    }
  }
  candidateBranches.push('origin/main', 'main', 'origin/master', 'master');

  const uniqueBranches = Array.from(new Set(candidateBranches.filter(Boolean)));

  let baselineCommit = '';
  for (const candidate of uniqueBranches) {
    const mb = await runGit(['merge-base', 'HEAD', candidate], cwd);
    if (mb) {
      baselineCommit = mb;
      break;
    }
  }

  if (!baselineCommit) {
    const isShallow = await runGit(
      ['rev-parse', '--is-shallow-repository'],
      cwd,
    );
    if (isShallow === 'true') {
      console.warn(
        '[diffra] Warning: Shallow Git repository detected. For accurate merge-base baseline discovery in CI, checkout with "fetch-depth: 0".',
      );
    }
    baselineCommit = commit;
  }

  return {
    branch,
    commit,
    baselineCommit,
    repositoryUrl,
  };
}
