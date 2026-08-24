import type React from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import { Badge } from '../ui/Badge.js';

export const Header: React.FC = () => {
  const { manifest, openOverview } = useViewer();
  const summary = manifest?.summary;

  return (
    <header className="h-14 bg-white border-b border-zinc-200/80 flex items-center justify-between px-5 shrink-0 z-20">
      {/* Brand & Branch Comparison */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={openOverview}
          className="flex items-center gap-2 text-inherit bg-transparent border-none p-0 cursor-pointer outline-none group"
          title="Go to Test Run Overview"
        >
          <span className="w-6 h-6 bg-zinc-900 text-white rounded-md flex items-center justify-center text-xs font-bold tracking-wider group-hover:bg-zinc-800 transition-colors">
            S
          </span>
          <span className="text-sm font-semibold text-zinc-900 tracking-tight">
            Diffra
          </span>
        </button>

        {manifest ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500 pl-2 border-l border-zinc-200">
            <span className="font-medium text-zinc-800 font-mono">
              {manifest.branch}
            </span>
            {manifest.commit && manifest.commit !== 'uncommitted' ? (
              <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-mono text-[11px] border border-zinc-200/70">
                {manifest.commit.substring(0, 7)}
              </span>
            ) : null}

            {manifest.baselineBranch ? (
              <>
                <span className="text-zinc-400 font-normal">vs</span>
                <span className="font-medium text-zinc-600 font-mono">
                  {manifest.baselineBranch}
                </span>
                {manifest.baselineCommit &&
                manifest.baselineCommit !== 'uncommitted' ? (
                  <span className="bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-mono text-[11px] border border-zinc-200/70">
                    {manifest.baselineCommit.substring(0, 7)}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Summary Badges */}
      {summary ? (
        <div className="flex items-center gap-2">
          {summary.changed > 0 ? (
            <Badge variant="changed">{summary.changed} Changed</Badge>
          ) : null}
          {summary.added > 0 ? (
            <Badge variant="added">{summary.added} Added</Badge>
          ) : null}
          {summary.removed > 0 ? (
            <Badge variant="removed">{summary.removed} Removed</Badge>
          ) : null}
          <Badge variant="unchanged">{summary.unchanged} Passed</Badge>
        </div>
      ) : null}
    </header>
  );
};
