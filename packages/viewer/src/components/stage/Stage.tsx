import type React from 'react';
import { Eye, Pause } from 'lucide-react';
import { useViewer } from '../../context/ViewerContext.js';
import type { ZoomLevel } from '../../types/index.js';
import { IconButton } from '../ui/IconButton.js';
import { DiffHighlightView } from './views/DiffHighlightView.js';
import { DiffMaskView } from './views/DiffMaskView.js';
import { GalleryView } from './views/GalleryView.js';
import { OnionSkin } from './views/OnionSkin.js';
import { SplitView } from './views/SplitView.js';
import { SwipeSlider } from './views/SwipeSlider.js';

export const Stage: React.FC = () => {
  const {
    manifest,
    viewMode,
    activeStory,
    activeMode,
    zoom,
    setZoom,
    swipePos,
    onionOpacity,
    setOnionOpacity,
    highlightBoxes,
    setHighlightBoxes,
    isBlinking,
    toggleBlink,
  } = useViewer();

  const zoomOptions: ZoomLevel[] = [
    '50%',
    '75%',
    '100%',
    '150%',
    '200%',
    'fit',
  ];

  if (viewMode === 'overview' || !activeStory) {
    return (
      <main className="flex-1 flex flex-col h-full bg-zinc-50 overflow-hidden">
        <GalleryView />
      </main>
    );
  }

  const baselineBranch = manifest?.baselineBranch || 'main';
  const candidateBranch = manifest?.branch || 'current';
  const repoUrl = (manifest?.repositoryUrl || 'https://github.com/Diffra/core').replace(/\/$/, '');

  const baselineBranchHref = `${repoUrl}/tree/${baselineBranch}`;
  const candidateBranchHref = `${repoUrl}/tree/${candidateBranch}`;
  const baselineCommitHref =
    manifest?.baselineCommit && manifest.baselineCommit !== 'uncommitted'
      ? `${repoUrl}/commit/${manifest.baselineCommit}`
      : undefined;
  const candidateCommitHref =
    manifest?.commit && manifest.commit !== 'uncommitted'
      ? `${repoUrl}/commit/${manifest.commit}`
      : undefined;

  return (
    <main className="flex-1 flex flex-col h-full bg-zinc-50 overflow-hidden">
      {/* Shared Comparison Context Header (Always above the comparison) */}
      <div className="h-12 bg-white border-b border-zinc-200/80 flex items-center justify-between px-6 shrink-0 select-none text-ui-base">
        {/* Baseline vs Candidate Context with GitHub Links */}
        <div className="flex items-center gap-2 text-ui-medium text-zinc-700">
          <span className="font-medium text-zinc-900">Baseline</span>

          <a
            href={baselineBranchHref}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-800 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/70 px-2.5 py-0.5 rounded-md text-ui-base no-underline transition-colors shadow-xs"
            title={`View ${baselineBranch} branch on GitHub`}
          >
            {baselineBranch}
          </a>

          {manifest?.baselineCommit &&
          manifest.baselineCommit !== 'uncommitted' ? (
            <a
              href={baselineCommitHref}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-500 hover:text-zinc-900 text-ui-base no-underline transition-colors hover:underline"
              title={`View baseline commit ${manifest.baselineCommit} on GitHub`}
            >
              ({manifest.baselineCommit.substring(0, 7)})
            </a>
          ) : null}

          <span className="text-zinc-400 font-normal mx-1">vs</span>

          <span className="font-medium text-zinc-900">Candidate</span>

          <a
            href={candidateBranchHref}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-800 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/70 px-2.5 py-0.5 rounded-md text-ui-base no-underline transition-colors shadow-xs"
            title={`View ${candidateBranch} branch on GitHub`}
          >
            {candidateBranch}
          </a>

          {manifest?.commit && manifest.commit !== 'uncommitted' ? (
            <a
              href={candidateCommitHref}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-500 hover:text-zinc-900 text-ui-base no-underline transition-colors hover:underline"
              title={`View candidate commit ${manifest.commit} on GitHub`}
            >
              ({manifest.commit.substring(0, 7)})
            </a>
          ) : null}
        </div>

        {/* Mode-specific interactive controls in the shared bar */}
        {activeMode === 'split' ? (
          <div className="flex items-center gap-2 text-ui-medium">
            <span className="text-zinc-500 font-normal">Zoom:</span>
            <select
              value={zoom}
              onChange={(e) => setZoom(e.target.value as ZoomLevel)}
              className="bg-zinc-100 hover:bg-zinc-200/70 text-zinc-800 border border-zinc-200/70 rounded-lg px-2.5 py-1 text-ui-medium cursor-pointer outline-none transition-colors shadow-xs"
            >
              {zoomOptions.map((z) => (
                <option key={z} value={z}>
                  {z === 'fit' ? 'Fit' : z}
                </option>
              ))}
            </select>
          </div>
        ) : activeMode === 'swipe' ? (
          <div className="flex items-center gap-2 text-ui-medium">
            <span className="text-zinc-500 font-normal">Split Position:</span>
            <span className="text-zinc-900 bg-zinc-100 border border-zinc-200/70 px-2.5 py-0.5 rounded-md text-ui-semibold shadow-xs">
              {swipePos}%
            </span>
          </div>
        ) : activeMode === 'onion' ? (
          <div className="flex items-center gap-2.5 text-ui-medium">
            <span className="text-zinc-500 font-normal">Opacity:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={onionOpacity}
              onChange={(e) => setOnionOpacity(parseFloat(e.target.value))}
              className="cursor-pointer accent-zinc-900 w-28"
            />
            <span className="text-zinc-900 bg-zinc-100 border border-zinc-200/70 px-2.5 py-0.5 rounded-md text-ui-semibold shadow-xs">
              {Math.round(onionOpacity * 100)}%
            </span>
          </div>
        ) : activeMode === 'mask' ? (
          <div className="flex items-center gap-3 text-ui-medium">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={highlightBoxes}
                onChange={(e) => setHighlightBoxes(e.target.checked)}
                className="cursor-pointer accent-rose-600 rounded w-4 h-4"
              />
              <span className="text-zinc-900 font-medium">Diff Regions</span>
            </label>
            {activeStory.baselineUrl && activeStory.candidateUrl ? (
              <IconButton
                icon={
                  isBlinking ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )
                }
                label={isBlinking ? 'Stop Blink' : 'Blink Mode'}
                active={isBlinking}
                onClick={toggleBlink}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Stage Viewport Area */}
      <div className="flex-1 p-6 relative overflow-hidden flex min-h-0">
        {activeMode === 'split' ? (
          <SplitView />
        ) : activeMode === 'swipe' ? (
          <SwipeSlider />
        ) : activeMode === 'onion' ? (
          <OnionSkin />
        ) : activeMode === 'highlight' ? (
          <DiffHighlightView />
        ) : (
          <DiffMaskView />
        )}
      </div>
    </main>
  );
};
