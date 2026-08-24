import type React from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import type { DiffMode, ZoomLevel } from '../../types/index.js';
import { Badge } from '../ui/Badge.js';
import { IconButton } from '../ui/IconButton.js';
import {
  IconChevronLeft,
  IconChevronRight,
  IconMask,
  IconOnion,
  IconSplit,
  IconSwipe,
} from '../ui/Icons.js';

export const StageToolbar: React.FC = () => {
  const {
    viewMode,
    activeStory,
    openOverview,
    activeMode,
    setActiveMode,
    zoom,
    setZoom,
    goToPrevStory,
    goToNextStory,
  } = useViewer();

  const modeOptions: {
    id: DiffMode;
    label: string;
    shortcut: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'split',
      label: 'Split',
      shortcut: '1',
      icon: <IconSplit className="w-3.5 h-3.5" />,
    },
    {
      id: 'swipe',
      label: 'Swipe',
      shortcut: '2',
      icon: <IconSwipe className="w-3.5 h-3.5" />,
    },
    {
      id: 'onion',
      label: 'Onion',
      shortcut: '3',
      icon: <IconOnion className="w-3.5 h-3.5" />,
    },
    {
      id: 'mask',
      label: 'Diff Mask',
      shortcut: '4',
      icon: <IconMask className="w-3.5 h-3.5" />,
    },
  ];

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
      <header className="h-14 bg-white border-b border-zinc-200/80 flex items-center justify-between px-6 gap-4 shrink-0 z-10 select-none">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 tracking-tight m-0">
            Overview Dashboard
          </h2>
          <span className="text-xs text-zinc-400">
            All visual regression snapshots across test runs
          </span>
        </div>
      </header>
    );
  }

  return (
    <header className="h-14 bg-white border-b border-zinc-200/80 flex items-center justify-between px-5 gap-4 shrink-0 z-10 select-none">
      {/* Left: Breadcrumbs & Story Title & Metadata */}
      <div className="flex items-center gap-2.5 overflow-hidden">
        {/* Back to Overview */}
        <button
          type="button"
          onClick={openOverview}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 bg-transparent hover:bg-zinc-100 px-2 py-1 rounded-md transition-colors border border-transparent cursor-pointer outline-none"
          title="Back to Overview (Esc or 0)"
        >
          <IconChevronLeft className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        <span className="text-zinc-300">/</span>

        <h2 className="text-sm font-semibold text-zinc-900 truncate m-0 flex items-center gap-1.5">
          <span className="text-zinc-400 font-normal">
            {activeStory.component} /
          </span>
          <span>{activeStory.name}</span>
        </h2>

        <Badge variant={activeStory.status}>{activeStory.status}</Badge>

        {activeStory.status === 'changed' && activeStory.diffPercentage > 0 ? (
          <span className="font-mono text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
            {activeStory.diffPercentage.toFixed(2)}% diff (
            {activeStory.diffCount} px)
          </span>
        ) : null}

        <span className="font-mono text-[11px] text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200/70 whitespace-nowrap">
          {activeStory.viewport.width}×{activeStory.viewport.height}
        </span>
      </div>

      {/* Right: Traversal, Mode Switch & Zoom */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Prev / Next Story */}
        <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/60">
          <button
            type="button"
            onClick={goToPrevStory}
            className="p-1 rounded text-zinc-500 hover:text-zinc-900 hover:bg-white transition-all border-none bg-transparent cursor-pointer outline-none"
            title="Previous Story (k or Up)"
          >
            <IconChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={goToNextStory}
            className="p-1 rounded text-zinc-500 hover:text-zinc-900 hover:bg-white transition-all border-none bg-transparent cursor-pointer outline-none"
            title="Next Story (j or Down)"
          >
            <IconChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mode Segmented Controls */}
        <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/60 gap-0.5">
          {modeOptions.map((opt) => (
            <IconButton
              key={opt.id}
              icon={opt.icon}
              label={opt.label}
              shortcut={opt.shortcut}
              active={activeMode === opt.id}
              onClick={() => setActiveMode(opt.id)}
            />
          ))}
        </div>

        {/* Zoom Selector (Split Mode) */}
        {activeMode === 'split' ? (
          <select
            value={zoom}
            onChange={(e) => setZoom(e.target.value as ZoomLevel)}
            className="bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 border border-zinc-200/60 rounded-lg px-2.5 py-1 text-xs font-mono font-medium cursor-pointer outline-none transition-colors"
          >
            {zoomOptions.map((z) => (
              <option key={z} value={z}>
                {z === 'fit' ? 'Fit to pane' : z}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </header>
  );
};
