import { SHORT_COMMIT_LENGTH } from './constants.js';

const UNCOMMITTED = 'uncommitted';

function base(repositoryUrl: string): string {
  return repositoryUrl.replace(/\/$/, '');
}

/** Link to a branch, or undefined when the report names no repository. */
export function branchUrl(
  repositoryUrl: string | undefined,
  branch: string | undefined,
): string | undefined {
  if (!repositoryUrl || !branch) return undefined;
  return `${base(repositoryUrl)}/tree/${branch}`;
}

/** Link to a commit, or undefined when it is unknown or not yet committed. */
export function commitUrl(
  repositoryUrl: string | undefined,
  commit: string | undefined,
): string | undefined {
  if (!repositoryUrl || !commit || commit === UNCOMMITTED) return undefined;
  return `${base(repositoryUrl)}/commit/${commit}`;
}

export function shortCommit(commit: string | undefined): string | undefined {
  if (!commit || commit === UNCOMMITTED) return undefined;
  return commit.slice(0, SHORT_COMMIT_LENGTH);
}
