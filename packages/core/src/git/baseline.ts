import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitInfo {
  branch: string;
  commit: string;
  baselineCommit: string;
  baselineBranch?: string;
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
 * Automatically resolves the baseline branch using CI metadata, upstream tracking,
 * remote HEAD, or topological nearest-neighbor DAG analysis when not explicitly provided.
 */
export async function getGitInfo(
  targetBaselineBranch?: string,
  cwd = process.cwd(),
): Promise<GitInfo> {
  // 1. Get current commit SHA
  let commit = await runGit(['rev-parse', 'HEAD'], cwd);
  if (!commit) {
    commit = 'uncommitted';
  }

  // 2. Get current branch
  let branch = await runGit(['branch', '--show-current'], cwd);
  if (!branch) {
    branch =
      process.env.GITHUB_HEAD_REF ||
      process.env.GITHUB_REF_NAME ||
      process.env.CI_COMMIT_REF_NAME ||
      'HEAD';
  }

  // 3. Discover repository URL
  let repositoryUrl: string | undefined;
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY) {
    repositoryUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
  } else {
    const remoteUrl = await runGit(
      ['config', '--get', 'remote.origin.url'],
      cwd,
    );
    repositoryUrl = parseGitRemoteUrl(remoteUrl);
  }

  // 4. Resolve baseline branch and merge-base commit
  let resolvedBaselineBranch = targetBaselineBranch;
  let baselineCommit = '';

  // Check CI target branch if targetBaselineBranch was not explicitly given
  if (!resolvedBaselineBranch) {
    resolvedBaselineBranch =
      process.env.GITHUB_BASE_REF ||
      process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME ||
      process.env.CHANGE_TARGET ||
      undefined;
  }

  if (resolvedBaselineBranch) {
    // Attempt merge-base with explicit or CI-provided target branch
    const candidates = [
      resolvedBaselineBranch,
      resolvedBaselineBranch.startsWith('origin/')
        ? resolvedBaselineBranch.replace(/^origin\//, '')
        : `origin/${resolvedBaselineBranch}`,
    ];

    for (const candidate of candidates) {
      const mb = await runGit(['merge-base', 'HEAD', candidate], cwd);
      if (mb) {
        baselineCommit = mb;
        resolvedBaselineBranch = candidate;
        break;
      }
    }
  }

  // If still unresolved, discover candidates dynamically from Git DAG topology
  if (!baselineCommit) {
    const candidateRefs: string[] = [];

    // Check upstream tracking branch
    const upstream = await runGit(
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
      cwd,
    );
    if (upstream && upstream !== branch && upstream !== `origin/${branch}`) {
      candidateRefs.push(upstream);
    }

    // Check remote default branch (e.g., refs/remotes/origin/HEAD)
    const remoteHead = await runGit(
      ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
      cwd,
    );
    if (remoteHead) {
      candidateRefs.push(remoteHead);
    }

    // Check all remote tracking branches
    const remoteRefsRaw = await runGit(
      ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin'],
      cwd,
    );
    if (remoteRefsRaw) {
      const remoteBranches = remoteRefsRaw
        .split('\n')
        .map((s) => s.trim())
        .filter(
          (ref) =>
            ref &&
            ref !== 'origin/HEAD' &&
            ref !== `origin/${branch}` &&
            ref !== branch,
        );
      candidateRefs.push(...remoteBranches);
    }

    // Check local branches if no remotes are present
    const localRefsRaw = await runGit(
      ['for-each-ref', '--format=%(refname:short)', 'refs/heads'],
      cwd,
    );
    if (localRefsRaw) {
      const localBranches = localRefsRaw
        .split('\n')
        .map((s) => s.trim())
        .filter((ref) => ref && ref !== branch);
      candidateRefs.push(...localBranches);
    }

    const uniqueCandidates = Array.from(new Set(candidateRefs));

    // Evaluate candidates to find the topological nearest neighbor (minimum distance to HEAD)
    let minDistance = Infinity;
    let bestCandidate = '';
    let bestMergeBase = '';

    for (const candidate of uniqueCandidates) {
      const mb = await runGit(['merge-base', 'HEAD', candidate], cwd);
      if (mb) {
        // Distance is the number of commits from merge-base to HEAD
        const distanceStr = await runGit(
          ['rev-list', '--count', `${mb}..HEAD`],
          cwd,
        );
        const distance = parseInt(distanceStr, 10);
        const validDistance = isNaN(distance) ? Infinity : distance;

        if (validDistance < minDistance) {
          minDistance = validDistance;
          bestCandidate = candidate;
          bestMergeBase = mb;
          if (minDistance === 0) {
            break;
          }
        }
      }
    }

    if (bestMergeBase) {
      baselineCommit = bestMergeBase;
      resolvedBaselineBranch = bestCandidate;
    }
  }

  // Fallback for shallow clone or detached initial states
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
    baselineBranch: resolvedBaselineBranch || branch,
    repositoryUrl,
  };
}
