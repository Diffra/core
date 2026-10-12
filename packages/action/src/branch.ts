/**
 * Evaluates whether a branch or boolean option matches the current git ref.
 */
export function matchesBranchOrBool(
  inputValue: string,
  currentRef: string,
  defaultBranch?: string,
): boolean {
  if (!inputValue || inputValue === 'false') return false;
  if (inputValue === 'true') return true;

  const currentBranch = currentRef.replace(/^refs\/heads\//, '');
  if (inputValue === 'default-branch') {
    return defaultBranch
      ? currentBranch === defaultBranch
      : currentBranch === 'main' || currentBranch === 'master';
  }
  return (
    currentBranch === inputValue || currentRef === `refs/heads/${inputValue}`
  );
}
