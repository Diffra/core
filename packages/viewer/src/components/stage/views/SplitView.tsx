import type React from 'react';
import { useViewer } from '../../../context/ViewerContext.js';

export const SplitView: React.FC = () => {
  const { manifest, activeStory, zoom } = useViewer();

  if (!activeStory) return null;

  const scaleVal = zoom === 'fit' ? '1' : `${parseInt(zoom, 10) / 100}`;
  const baselineBranch = manifest.baselineBranch || 'main';
  const candidateBranch = manifest.branch || 'current';

  return (
    <div className="grid grid-cols-2 gap-4 p-5 w-full h-full overflow-hidden select-none">
      {/* Baseline Pane */}
      <div className="flex flex-col gap-2 h-full min-h-0">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-800">
              Baseline
            </span>
            <span className="text-[11px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/70">
              {baselineBranch}
            </span>
            {manifest.baselineCommit &&
            manifest.baselineCommit !== 'uncommitted' ? (
              <span className="text-[11px] font-mono text-zinc-400">
                ({manifest.baselineCommit.substring(0, 7)})
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 bg-white border border-zinc-200/80 rounded-xl overflow-auto canvas-backdrop min-h-0 shadow-xs">
          {activeStory.baselineUrl ? (
            <img
              src={activeStory.baselineUrl}
              alt={`Baseline on ${baselineBranch}`}
              className={`split-zoom-stage ${
                zoom === 'fit' ? 'max-w-full' : 'max-w-none'
              } h-auto`}
              style={
                {
                  '--zoom-scale': scaleVal,
                } as React.CSSProperties
              }
            />
          ) : (
            <div className="text-xs text-zinc-400 font-medium">
              No baseline on {baselineBranch}
            </div>
          )}
        </div>
      </div>

      {/* Candidate Pane */}
      <div className="flex flex-col gap-2 h-full min-h-0">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-800">
              Candidate
            </span>
            <span className="text-[11px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/70">
              {candidateBranch}
            </span>
            {manifest.commit && manifest.commit !== 'uncommitted' ? (
              <span className="text-[11px] font-mono text-zinc-400">
                ({manifest.commit.substring(0, 7)})
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 bg-white border border-zinc-200/80 rounded-xl overflow-auto canvas-backdrop min-h-0 shadow-xs">
          {activeStory.candidateUrl ? (
            <img
              src={activeStory.candidateUrl}
              alt={`Candidate on ${candidateBranch}`}
              className={`split-zoom-stage ${
                zoom === 'fit' ? 'max-w-full' : 'max-w-none'
              } h-auto`}
              style={
                {
                  '--zoom-scale': scaleVal,
                } as React.CSSProperties
              }
            />
          ) : (
            <div className="text-xs text-zinc-400 font-medium">
              No candidate image
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
