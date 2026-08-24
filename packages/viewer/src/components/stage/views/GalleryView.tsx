import type React from 'react';
import { useViewer } from '../../../context/ViewerContext.js';
import { Badge } from '../../ui/Badge.js';

export const GalleryView: React.FC = () => {
  const { manifest, filteredResults, selectStoryById } = useViewer();
  const summary = manifest?.summary;
  const baselineBranch = manifest?.baselineBranch || 'main';

  const handleCardClick = (id: string) => {
    selectStoryById(id);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 lg:p-8 bg-zinc-50 font-sans select-none">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Overview Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-200/80">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 m-0 tracking-tight">
              Test Run Overview
            </h1>
            <p className="text-xs text-zinc-500 mt-1 mb-0 font-mono">
              <span>{manifest?.branch}</span>
              <span className="text-zinc-400 font-sans mx-1.5">vs</span>
              <span>{baselineBranch}</span>
              {manifest?.timestamp ? (
                <span className="text-zinc-400 font-sans ml-3">
                  · {new Date(manifest.timestamp).toLocaleString()}
                </span>
              ) : null}
            </p>
          </div>

          {/* Metric Summary Cards */}
          {summary ? (
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex flex-col bg-white border border-zinc-200/80 rounded-xl px-3.5 py-2 min-w-20 shadow-xs">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                  Total
                </span>
                <span className="text-base font-bold text-zinc-900 font-mono">
                  {summary.total}
                </span>
              </div>
              <div className="flex flex-col bg-amber-500/5 border border-amber-500/20 rounded-xl px-3.5 py-2 min-w-20 shadow-xs">
                <span className="text-[10px] text-amber-700 uppercase tracking-wider font-semibold">
                  Changed
                </span>
                <span className="text-base font-bold text-amber-800 font-mono">
                  {summary.changed}
                </span>
              </div>
              <div className="flex flex-col bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3.5 py-2 min-w-20 shadow-xs">
                <span className="text-[10px] text-emerald-700 uppercase tracking-wider font-semibold">
                  Added
                </span>
                <span className="text-base font-bold text-emerald-800 font-mono">
                  {summary.added}
                </span>
              </div>
              {summary.removed > 0 ? (
                <div className="flex flex-col bg-rose-500/5 border border-rose-500/20 rounded-xl px-3.5 py-2 min-w-20 shadow-xs">
                  <span className="text-[10px] text-rose-700 uppercase tracking-wider font-semibold">
                    Removed
                  </span>
                  <span className="text-base font-bold text-rose-800 font-mono">
                    {summary.removed}
                  </span>
                </div>
              ) : null}
              <div className="flex flex-col bg-zinc-100/80 border border-zinc-200/80 rounded-xl px-3.5 py-2 min-w-20 shadow-xs">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  Passed
                </span>
                <span className="text-base font-bold text-zinc-700 font-mono">
                  {summary.unchanged}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Snapshots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResults.map((story) => (
            <button
              type="button"
              key={story.id}
              onClick={() => handleCardClick(story.id)}
              className="text-left w-full flex flex-col bg-white border border-zinc-200/80 hover:border-zinc-400 rounded-xl overflow-hidden cursor-pointer transition-all duration-150 group shadow-xs hover:shadow-sm"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-100 bg-white">
                <div className="overflow-hidden pr-2 flex flex-col gap-0.5">
                  <div className="text-xs font-semibold text-zinc-900 truncate">
                    <span className="text-zinc-400 font-normal">
                      {story.component} /{' '}
                    </span>
                    {story.name}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {story.status === 'changed' && story.diffPercentage > 0 ? (
                    <span className="font-mono text-[10px] text-amber-700 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                      {story.diffPercentage.toFixed(1)}%
                    </span>
                  ) : null}
                  <Badge variant={story.status}>{story.status}</Badge>
                </div>
              </div>

              {/* Card Preview Area */}
              <div className="h-44 bg-zinc-50/50 flex items-center justify-center p-3 overflow-hidden relative checkerboard">
                {story.candidateUrl || story.baselineUrl || story.diffUrl ? (
                  <img
                    src={
                      story.diffUrl || story.candidateUrl || story.baselineUrl
                    }
                    alt={`${story.component} - ${story.name}`}
                    className="max-h-full max-w-full object-contain drop-shadow-xs transition-transform duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xs text-zinc-400 font-medium">
                    No preview available
                  </span>
                )}
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between px-3.5 py-1.5 border-t border-zinc-100 bg-zinc-50/40 text-[11px] text-zinc-400 font-mono">
                <span>
                  {story.viewport.width}×{story.viewport.height} (
                  {story.viewport.name})
                </span>
                {story.status === 'changed' && story.diffCount > 0 ? (
                  <span>{story.diffCount} px diff</span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
