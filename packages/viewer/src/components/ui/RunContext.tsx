import type React from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import { branchUrl, commitUrl, shortCommit } from '../../lib/links.js';

/** A branch or commit, linked to the repository when the report names one. */
const Ref: React.FC<{
  href: string | undefined;
  className: string;
  children: React.ReactNode;
}> = ({ href, className, children }) =>
  href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`no-underline transition-colors ${className}`}
    >
      {children}
    </a>
  ) : (
    <span className={className}>{children}</span>
  );

/** Which two states of the project this review compares, on one line. */
export const RunContext: React.FC = () => {
  const { manifest } = useViewer();
  const { repositoryUrl, branch, commit, baselineBranch, baselineCommit } =
    manifest;
  const commitShort = shortCommit(commit);
  const baselineShort = shortCommit(baselineCommit);

  return (
    <p className="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-ink-3">
      <Ref
        href={branchUrl(repositoryUrl, branch)}
        className="text-ink hover:text-accent"
      >
        {branch || 'Unknown branch'}
      </Ref>
      {commitShort ? (
        <Ref href={commitUrl(repositoryUrl, commit)} className="hover:text-ink">
          {commitShort}
        </Ref>
      ) : null}
      {baselineBranch ? (
        <>
          <span>compared with</span>
          <Ref
            href={branchUrl(repositoryUrl, baselineBranch)}
            className="text-ink-2 hover:text-accent"
          >
            {baselineBranch}
          </Ref>
          {baselineShort ? (
            <Ref
              href={commitUrl(repositoryUrl, baselineCommit)}
              className="hover:text-ink"
            >
              {baselineShort}
            </Ref>
          ) : null}
        </>
      ) : null}
    </p>
  );
};
