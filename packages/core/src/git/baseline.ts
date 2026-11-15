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
 * Runs a git command safely in the specified cwd with an execution timeout.
 */
async function runGit(
  args: string[],
  cwd = process.cwd(),
  timeout = 10000,
): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd, timeout });
    return stdout.trim();
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'killed' in error &&
      (error as { killed: boolean }).killed
    ) {
      console.warn(
        `[diffra] Warning: Git command "git ${args.join(' ')}" timed out after ${timeout}ms.`,
      );
    }
    return '';
  }
}

/**
 * Converts SSH or HTTPS remote URLs into a standard HTTPS web URL.
 * Credentials embedded in a remote, such as a CI job token, are dropped: the
 * result is written into reports that are shared.
 */
export function parseGitRemoteUrl(rawUrl: string): string | undefined {
  if (!rawUrl) return undefined;

  // Handle git@host:owner/repo.git
  const sshMatch = rawUrl.match(/^git@([^:]+):([^/]+)\/(.+?)(\.git)?$/);
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}/${sshMatch[3]}`;
  }

  // Handle http(s)://[credentials@]host/owner/repo[.git]
  if (/^https?:\/\//i.test(rawUrl)) {
    try {
      const url = new URL(rawUrl);
      const repository = url.pathname.replace(/\.git$/, '').replace(/\/+$/, '');
      return `https://${url.host}${repository}`;
    } catch {
      return undefined;
    }
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
        const validDistance = Number.isNaN(distance) ? Infinity : distance;

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

/** How many first-parent commits to search for baselines by default. */
export const DEFAULT_BASELINE_HISTORY_DEPTH = 10;

/**
 * Lists the commit followed by its first-parent ancestors, newest first.
 * A baseline is only stored for commits that ran visual tests, so lookups
 * walk this list until one of them has a stored baseline.
 */
export async function getBaselineHistory(
  commit: string,
  depth = DEFAULT_BASELINE_HISTORY_DEPTH,
  cwd = process.cwd(),
): Promise<string[]> {
  const raw = await runGit(
    ['rev-list', '--first-parent', `--max-count=${Math.max(1, depth)}`, commit],
    cwd,
  );
  const commits = raw.split('\n').filter(Boolean);
  return commits.length > 0 ? commits : [commit];
}

/**
 * Files that differ from a commit: committed changes since it, uncommitted
 * edits, and files git does not track yet. Paths are relative to `cwd`. Empty
 * when there is no commit to compare with or git is unavailable.
 */
export async function changedFilesSince(
  commit: string | undefined,
  cwd = process.cwd(),
): Promise<string[]> {
  if (!commit) return [];
  const [tracked, untracked] = await Promise.all([
    runGit(['diff', '--name-only', '--no-renames', '--relative', commit], cwd),
    runGit(['ls-files', '--others', '--exclude-standard'], cwd),
  ]);
  return [
    ...new Set(
      `${tracked}\n${untracked}`
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
}
