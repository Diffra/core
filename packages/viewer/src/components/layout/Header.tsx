import type React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  Layers,
  LayoutGrid,
  ScanEye,
  SlidersHorizontal,
  SquareDashed,
} from 'lucide-react';
import { useViewer } from '../../context/ViewerContext.js';
import type { DiffMode } from '../../types/index.js';

export const Header: React.FC = () => {
  const {
    viewMode,
    activeStory,
    openOverview,
    activeMode,
    setActiveMode,
    goToPrevStory,
    goToNextStory,
  } = useViewer();

  const modeOptions: {
    id: DiffMode;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'highlight',
      label: 'Movement',
      icon: <ScanEye className="w-4 h-4" />,
    },
    {
      id: 'split',
      label: 'Split',
      icon: <Columns2 className="w-4 h-4" />,
    },
    {
      id: 'swipe',
      label: 'Swipe',
      icon: <SlidersHorizontal className="w-4 h-4" />,
    },
    {
      id: 'onion',
      label: 'Onion',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'mask',
      label: 'Mask',
      icon: <SquareDashed className="w-4 h-4" />,
    },
  ];

  const isOverview = viewMode === 'overview' || !activeStory;

  return (
    <header className="h-16 bg-white border-b border-zinc-200/80 flex items-center justify-between px-6 shrink-0 z-20 select-none text-ui-base">
      {/* Left section: Brand & Exactly 2 breadcrumb buttons */}
      <div className="flex items-center gap-2.5 overflow-hidden">
        {/* Brand / Logo */}
        <button
          type="button"
          onClick={openOverview}
          className="flex items-center gap-2.5 bg-transparent border-none p-0 cursor-pointer outline-none group shrink-0 mr-2"
          title="Diffra Visual Regression"
        >
          <span className="w-7 h-7 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-ui-semibold tracking-tight group-hover:bg-zinc-800 transition-colors">
            D
          </span>
          <span className="text-ui-semibold text-zinc-900 tracking-tight">
            Diffra
          </span>
        </button>

        {/* Breadcrumb 1: Overview Tab */}
        <button
          type="button"
          onClick={openOverview}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer outline-none border-none ${
            isOverview
              ? 'bg-zinc-100 text-zinc-900 font-medium shadow-xs'
              : 'bg-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 font-normal'
          }`}
          title="Overview Gallery"
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="text-ui-medium">Overview</span>
        </button>

        {/* Breadcrumb 2: Active Story pill (Single combined pill, no separators) */}
        {!isOverview && activeStory ? (
          <div className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 text-ui-medium font-medium truncate flex items-center gap-1.5">
            <span className="text-zinc-500 font-normal">
              {activeStory.component} /
            </span>
            <span>{activeStory.name}</span>
          </div>
        ) : null}
      </div>

      {/* Right section: Navigation traversal & Clean Inspection Mode Tabs */}
      {!isOverview && activeStory ? (
        <div className="flex items-center gap-4 shrink-0">
          {/* Previous / Next story traversal */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPrevStory}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors border-none bg-transparent cursor-pointer outline-none flex items-center"
              title="Previous Snapshot (k or Up)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToNextStory}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors border-none bg-transparent cursor-pointer outline-none flex items-center"
              title="Next Snapshot (j or Down)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Clean Inspection Mode Tabs */}
          <nav
            role="tablist"
            aria-label="Comparison modes"
            className="flex items-center gap-1"
          >
            {modeOptions.map((opt) => {
              const isActive = activeMode === opt.id;
              return (
                <button
                  key={opt.id}
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => setActiveMode(opt.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-ui-medium cursor-pointer transition-all duration-150 outline-none select-none border-none ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-900 font-medium shadow-xs'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 font-normal'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
};
