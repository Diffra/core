import type React from 'react';
import { useViewer } from '../../../context/ViewerContext.js';

export const SplitView: React.FC = () => {
  const { manifest, activeStory, zoom } = useViewer();

  if (!activeStory) return null;

  const scaleVal = zoom === 'fit' ? '1' : `${parseInt(zoom, 10) / 100}`;
  const baselineBranch = manifest?.baselineBranch || 'main';
  const candidateBranch = manifest?.branch || 'current';

  return (
    <div className="grid grid-cols-2 gap-5 w-full h-full overflow-hidden select-none text-ui-base">
      {/* Baseline Pane */}
      <div className="flex-1 flex items-center justify-center p-4 bg-white border border-zinc-200/80 rounded-2xl overflow-auto canvas-backdrop min-h-0 shadow-xs">
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
          <div className="text-ui-medium text-zinc-400">
            No baseline on {baselineBranch}
          </div>
        )}
      </div>

      {/* Candidate Pane */}
      <div className="flex-1 flex items-center justify-center p-4 bg-white border border-zinc-200/80 rounded-2xl overflow-auto canvas-backdrop min-h-0 shadow-xs">
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
          <div className="text-ui-medium text-zinc-400">No candidate image</div>
        )}
      </div>
    </div>
  );
};
