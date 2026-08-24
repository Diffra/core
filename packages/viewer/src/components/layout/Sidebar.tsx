import type React from 'react';
import { useMemo } from 'react';
import { Check, ListFilter, Search, X } from 'lucide-react';
import { useViewer } from '../../context/ViewerContext.js';
import type { FilterStatus, TestResult } from '../../types/index.js';
import { Badge } from '../ui/Badge.js';

export interface SidebarProps {
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const Sidebar: React.FC<SidebarProps> = ({ searchInputRef }) => {
  const {
    viewMode,
    activeStory,
    selectStoryById,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    filteredResults,
  } = useViewer();

  const filterOptions: { id: FilterStatus; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'changed', label: 'Changed' },
    { id: 'added', label: 'Added' },
    { id: 'unchanged', label: 'Passed' },
  ];

  // Group filtered results by component
  const groupedResults = useMemo(() => {
    const map = new Map<string, TestResult[]>();
    for (const item of filteredResults) {
      const list = map.get(item.component) || [];
      list.push(item);
      map.set(item.component, list);
    }
    return Array.from(map.entries());
  }, [filteredResults]);

  const isOverviewActive = viewMode === 'overview';

  const handleFilterSelect = (id: FilterStatus) => {
    setFilterStatus(id);
    const popoverEl = document.getElementById('filter-popover');
    if (popoverEl && 'hidePopover' in popoverEl) {
      try {
        (popoverEl as unknown as { hidePopover: () => void }).hidePopover();
      } catch {}
    }
  };

  return (
    <aside className="w-80 min-w-80 max-w-80 h-full bg-zinc-50 border-r border-zinc-200/80 flex flex-col overflow-hidden select-none text-ui-base">
      {/* Search & Filter Bar */}
      <div className="p-4 flex flex-col gap-2">
        <div className="relative flex items-center">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none flex items-center">
            <Search className="w-4 h-4" />
          </div>

          <input
            ref={searchInputRef}
            type="text"
            placeholder="Filter snapshots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-zinc-200/80 rounded-xl text-zinc-900 pl-9 pr-16 py-2 text-ui-base outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-400 shadow-xs"
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="bg-transparent border-none text-zinc-400 hover:text-zinc-600 cursor-pointer p-1 rounded flex items-center"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}

            {/* Filter popover button inside search input */}
            <button
              type="button"
              popoverTarget="filter-popover"
              className={`p-1.5 rounded-lg border cursor-pointer flex items-center transition-all ${
                filterStatus !== 'all'
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                  : 'bg-transparent text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 border-transparent'
              }`}
              title="Filter by status"
            >
              <ListFilter className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Native HTML Popover for Filter Selection */}
        <div
          id="filter-popover"
          popover="auto"
          className="m-0 p-1.5 bg-white rounded-xl border border-zinc-200 text-ui-base backdrop:bg-transparent shadow-lg"
          style={{
            position: 'absolute',
            top: '4.25rem',
            left: '1rem',
            width: '18rem',
          }}
        >
          <div className="flex flex-col gap-0.5">
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleFilterSelect(opt.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left cursor-pointer transition-colors border-none text-ui-medium ${
                  filterStatus === opt.id
                    ? 'bg-zinc-100 text-zinc-900 font-medium'
                    : 'bg-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 font-normal'
                }`}
              >
                <span>{opt.label}</span>
                {filterStatus === opt.id ? (
                  <Check className="w-4 h-4 text-zinc-900" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Item List (Grouped by Component) */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-4">
        {groupedResults.length === 0 ? (
          <div className="py-8 text-center text-zinc-400 text-ui-medium">
            No snapshots match filter
          </div>
        ) : (
          groupedResults.map(([componentName, items]) => (
            <div key={componentName} className="flex flex-col gap-1">
              {/* Component Section Headline (Non-clickable, distinct section header) */}
              <div className="px-3 pt-2 pb-1 text-ui-heading font-medium text-zinc-900 tracking-tight select-none cursor-default">
                {componentName}
              </div>

              {/* Component Items (Interactive snapshot buttons with clear active/hover states) */}
              {items.map((item) => {
                const isSelected =
                  !isOverviewActive && activeStory?.id === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => selectStoryById(item.id)}
                    className={`w-full text-left flex items-center justify-between px-3 py-2.5 cursor-pointer rounded-xl transition-all outline-none border text-ui-base group ${
                      isSelected
                        ? 'bg-white text-zinc-900 font-medium border-zinc-200/80 shadow-xs'
                        : 'bg-transparent hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 border-transparent'
                    }`}
                  >
                    <div className="overflow-hidden pr-2 flex flex-col gap-0.5">
                      <span className="text-ui-medium truncate group-hover:text-zinc-900">
                        {item.name}
                      </span>
                      {item.viewport?.name ? (
                        <span className="text-ui-base text-zinc-400 capitalize truncate">
                          {item.viewport.name}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={item.status}>{item.status}</Badge>
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
