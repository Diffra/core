import type React from 'react';
import { useMemo } from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import type { FilterStatus, TestResult } from '../../types/index.js';
import { Badge } from '../ui/Badge.js';
import { IconClose, IconOverview, IconSearch } from '../ui/Icons.js';

export interface SidebarProps {
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const Sidebar: React.FC<SidebarProps> = ({ searchInputRef }) => {
  const {
    manifest,
    viewMode,
    activeStory,
    openOverview,
    selectStoryById,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    filteredResults,
  } = useViewer();

  const summary = manifest?.summary;

  const filterTabs: { id: FilterStatus; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: summary?.total || 0 },
    { id: 'changed', label: 'Changed', count: summary?.changed || 0 },
    { id: 'added', label: 'Added', count: summary?.added || 0 },
    { id: 'unchanged', label: 'Passed', count: summary?.unchanged || 0 },
  ];

  // Group filtered results by component
  const groupedResults = useMemo(() => {
    const map = new Map<string, TestResult[]>();
    for (const story of filteredResults) {
      const list = map.get(story.component) || [];
      list.push(story);
      map.set(story.component, list);
    }
    return Array.from(map.entries());
  }, [filteredResults]);

  const isOverviewActive = viewMode === 'overview';

  return (
    <aside className="w-80 min-w-80 max-w-80 h-full bg-zinc-50 border-r border-zinc-200/80 flex flex-col overflow-hidden select-none">
      {/* Top Navigation: Overview Button */}
      <div className="p-3 pb-0">
        <button
          type="button"
          onClick={openOverview}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 outline-none text-left border ${
            isOverviewActive
              ? 'bg-white text-zinc-900 shadow-xs border-zinc-200 font-semibold'
              : 'bg-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border-transparent font-medium'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <IconOverview
              className={isOverviewActive ? 'text-zinc-900' : 'text-zinc-500'}
            />
            <span className="text-xs">Overview Dashboard</span>
          </div>
          <span className="font-mono text-[11px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
            {summary?.total || 0}
          </span>
        </button>
      </div>

      {/* Search & Filter Header */}
      <div className="p-3 flex flex-col gap-2.5 border-b border-zinc-200/80">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
            <IconSearch className="w-3.5 h-3.5" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-zinc-200 rounded-lg text-zinc-900 pl-8 pr-8 py-1.5 text-xs outline-none transition-colors font-sans focus:border-zinc-900 placeholder:text-zinc-400"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none text-zinc-400 hover:text-zinc-600 cursor-pointer p-0.5"
            >
              <IconClose className="w-3 h-3" />
            </button>
          ) : (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-[10px] bg-zinc-100 px-1 py-0.2 rounded border border-zinc-200 pointer-events-none">
              /
            </span>
          )}
        </div>

        {/* Filter Segmented Control */}
        <div className="flex bg-zinc-200/60 p-0.5 rounded-lg gap-0.5">
          {filterTabs.map((tab) => {
            const isActive = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`flex-1 border-none rounded-md py-1 px-1 text-[11px] font-sans cursor-pointer flex items-center justify-center gap-1 transition-all outline-none ${
                  isActive
                    ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                    : 'bg-transparent text-zinc-500 font-medium hover:text-zinc-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={
                    isActive
                      ? 'text-zinc-600 font-mono'
                      : 'text-zinc-400 font-mono'
                  }
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Story List (Grouped by Component) */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3">
        {groupedResults.length === 0 ? (
          <div className="py-8 text-center text-zinc-400 text-xs font-medium">
            No stories match filter
          </div>
        ) : (
          groupedResults.map(([componentName, stories]) => (
            <div key={componentName} className="flex flex-col gap-0.5">
              {/* Component Section Header */}
              <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                <span>{componentName}</span>
                <span className="font-mono text-[10px] text-zinc-400">
                  {stories.length}
                </span>
              </div>

              {/* Component Stories */}
              {stories.map((story) => {
                const isSelected =
                  !isOverviewActive && activeStory?.id === story.id;
                return (
                  <button
                    type="button"
                    key={story.id}
                    onClick={() => selectStoryById(story.id)}
                    className={`w-full text-left flex items-center justify-between px-2.5 py-2 cursor-pointer rounded-lg transition-all duration-150 outline-none font-sans border ${
                      isSelected
                        ? 'bg-white text-zinc-900 shadow-xs border-zinc-200 font-semibold'
                        : 'bg-transparent hover:bg-zinc-100/80 border-transparent text-zinc-700'
                    }`}
                  >
                    <div className="overflow-hidden pr-2 flex flex-col gap-0.5">
                      <span className="text-xs truncate">{story.name}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {story.viewport.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {story.status === 'changed' &&
                      story.diffPercentage > 0 ? (
                        <span className="font-mono text-[10px] text-amber-700 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                          {story.diffPercentage.toFixed(1)}%
                        </span>
                      ) : null}
                      <Badge variant={story.status}>{story.status}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
