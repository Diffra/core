import type React from 'react';
import { useViewer } from '../../../context/ViewerContext.js';
import { Badge } from '../../ui/Badge.js';

export const GalleryView: React.FC = () => {
  const { manifest, filteredResults, selectStoryById } = useViewer();
  const baselineBranch = manifest?.baselineBranch || 'main';
  const repoUrl = (manifest?.repositoryUrl || 'https://github.com/Diffra/core').replace(/\/$/, '');

  const handleCardClick = (id: string) => {
    selectStoryById(id);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-8 bg-zinc-50 select-none text-ui-base">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Overview Header Banner */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80">
          <div>
            <h1 className="text-ui-title text-zinc-900 m-0 tracking-tight">
              Test Run Overview
            </h1>
            <p className="text-ui-base text-zinc-600 mt-1 mb-0 flex items-center gap-2">
              <a
                href={`${repoUrl}/tree/${manifest?.branch || 'main'}`}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-900 font-medium hover:underline no-underline"
              >
                {manifest?.branch || 'main'}
              </a>

              <span className="text-zinc-400">vs</span>

              <a
                href={`${repoUrl}/tree/${baselineBranch}`}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-900 font-medium hover:underline no-underline"
              >
                {baselineBranch}
              </a>

              {manifest?.timestamp ? (
                <span className="text-zinc-400 ml-2">
                  · {new Date(manifest.timestamp).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Snapshots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResults.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => handleCardClick(item.id)}
              className="text-left w-full flex flex-col bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-150 group text-ui-base border border-zinc-200/80 hover:border-zinc-300 shadow-xs hover:shadow-sm outline-none"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 bg-white group-hover:bg-zinc-50/50 transition-colors">
                <div className="overflow-hidden pr-3 flex flex-col gap-0.5">
                  <div className="text-ui-medium text-zinc-900 truncate font-normal">
                    <span className="text-zinc-500 font-normal">
                      {item.component} /{' '}
                    </span>
                    <span className="font-medium text-zinc-900">{item.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={item.status}>{item.status}</Badge>
                </div>
              </div>

              {/* Card Preview Area */}
              <div className="h-48 bg-zinc-50/50 flex items-center justify-center p-4 overflow-hidden relative canvas-backdrop">
                {item.candidateUrl || item.baselineUrl || item.diffUrl ? (
                  <img
                    src={
                      item.diffUrl || item.candidateUrl || item.baselineUrl
                    }
                    alt={`${item.component} - ${item.name}`}
                    className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-ui-base text-zinc-400 font-medium">
                    No preview available
                  </span>
                )}
              </div>

              {/* Card Footer */}
              {item.viewport?.name ? (
                <div className="flex items-center justify-between px-4 py-2 bg-white group-hover:bg-zinc-50/50 text-ui-base text-zinc-400 transition-colors">
                  <span className="capitalize">{item.viewport.name}</span>
                </div>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
