import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useHashLocation } from 'wouter/use-hash-location';
import type {
  DiffMode,
  FilterStatus,
  TestResult,
  TestRunReport,
  ViewMode,
  ZoomLevel,
} from '../types/index.js';

interface ViewerContextValue {
  manifest: TestRunReport;
  viewMode: ViewMode;
  activeStoryId: string | null;
  activeStoryIndex: number;
  activeStory: TestResult | null;
  filteredResults: TestResult[];
  activeMode: DiffMode;
  filterStatus: FilterStatus;
  searchQuery: string;
  zoom: ZoomLevel;
  isBlinking: boolean;
  onionOpacity: number;
  swipePos: number;
  highlightBoxes: boolean;
  openOverview: () => void;
  selectStoryById: (id: string) => void;
  setActiveStoryIndex: (index: number) => void;
  setActiveMode: (mode: DiffMode) => void;
  setFilterStatus: (status: FilterStatus) => void;
  setSearchQuery: (query: string) => void;
  setZoom: (zoom: ZoomLevel) => void;
  toggleBlink: () => void;
  setOnionOpacity: (opacity: number) => void;
  setSwipePos: (pos: number) => void;
  setHighlightBoxes: (highlight: boolean) => void;
  goToNextStory: () => void;
  goToPrevStory: () => void;
}

const ViewerContext = createContext<ViewerContextValue | null>(null);

export interface ViewerProviderProps {
  manifest: TestRunReport;
  children: React.ReactNode;
}

export const ViewerProvider: React.FC<ViewerProviderProps> = ({
  manifest,
  children,
}) => {
  const [location, setLocation] = useHashLocation();

  // Parse initial route from hash location
  const parseRoute = (loc: string): { mode: ViewMode; id: string | null } => {
    if (!loc || loc === '/' || loc === '') {
      return { mode: 'overview', id: null };
    }
    if (loc.startsWith('/story/')) {
      const id = decodeURIComponent(loc.slice(7));
      return { mode: 'detail', id };
    }
    // Also support direct hash like #components-button--primary
    const cleanHash = loc.replace(/^\//, '');
    const matched = manifest?.results?.find((r) => r.id === cleanHash);
    if (matched) {
      return { mode: 'detail', id: matched.id };
    }
    return { mode: 'overview', id: null };
  };

  const initialRoute = useMemo(() => parseRoute(location), []);

  const [viewMode, setViewMode] = useState<ViewMode>(initialRoute.mode);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(
    initialRoute.id || manifest?.results?.[0]?.id || null,
  );
  const [activeMode, setActiveMode] = useState<DiffMode>('highlight');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState<ZoomLevel>('100%');
  const [isBlinking, setIsBlinking] = useState(false);
  const [onionOpacity, setOnionOpacity] = useState(0.5);
  const [swipePos, setSwipePos] = useState(50);
  const [highlightBoxes, setHighlightBoxes] = useState(true);

  // Sync state when URL hash changes (back/forward or deep link)
  useEffect(() => {
    const { mode, id } = parseRoute(location);
    setViewMode(mode);
    if (id) {
      setActiveStoryId(id);
    }
  }, [location, manifest?.results]);

  const filteredResults = useMemo(() => {
    if (!manifest?.results) return [];
    return manifest.results.filter((res) => {
      const matchStatus =
        filterStatus === 'all' ? true : res.status === filterStatus;
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        res.name.toLowerCase().includes(query) ||
        res.component.toLowerCase().includes(query);
      return matchStatus && matchSearch;
    });
  }, [manifest?.results, filterStatus, searchQuery]);

  const activeStoryIndex = useMemo(() => {
    if (!manifest?.results || !activeStoryId) return 0;
    const idx = manifest.results.findIndex((r) => r.id === activeStoryId);
    return idx >= 0 ? idx : 0;
  }, [manifest?.results, activeStoryId]);

  const activeStory = useMemo(() => {
    if (!manifest?.results || manifest.results.length === 0) return null;
    if (activeStoryId) {
      const found = manifest.results.find((r) => r.id === activeStoryId);
      if (found) return found;
    }
    return manifest.results[0] ?? null;
  }, [manifest?.results, activeStoryId]);

  const openOverview = () => {
    setViewMode('overview');
    setLocation('/');
  };

  const selectStoryById = (id: string) => {
    setActiveStoryId(id);
    setViewMode('detail');
    setLocation(`/story/${encodeURIComponent(id)}`);
  };

  const setActiveStoryIndex = (index: number) => {
    if (!manifest?.results || !manifest.results[index]) return;
    selectStoryById(manifest.results[index].id);
  };

  const goToNextStory = () => {
    if (filteredResults.length === 0) return;
    if (viewMode === 'overview') {
      const first = filteredResults[0];
      if (first) selectStoryById(first.id);
      return;
    }
    const currentFilteredIdx = filteredResults.findIndex(
      (r) => r.id === activeStory?.id,
    );
    const nextIdx =
      currentFilteredIdx >= 0
        ? (currentFilteredIdx + 1) % filteredResults.length
        : 0;
    const nextStory = filteredResults[nextIdx];
    if (nextStory) {
      selectStoryById(nextStory.id);
    }
  };

  const goToPrevStory = () => {
    if (filteredResults.length === 0) return;
    if (viewMode === 'overview') {
      const last = filteredResults[filteredResults.length - 1];
      if (last) selectStoryById(last.id);
      return;
    }
    const currentFilteredIdx = filteredResults.findIndex(
      (r) => r.id === activeStory?.id,
    );
    const prevIdx =
      currentFilteredIdx >= 0
        ? (currentFilteredIdx - 1 + filteredResults.length) %
          filteredResults.length
        : 0;
    const prevStory = filteredResults[prevIdx];
    if (prevStory) {
      selectStoryById(prevStory.id);
    }
  };

  const toggleBlink = () => {
    setIsBlinking((prev) => !prev);
  };

  const value: ViewerContextValue = {
    manifest,
    viewMode,
    activeStoryId,
    activeStoryIndex,
    activeStory,
    filteredResults,
    activeMode,
    filterStatus,
    searchQuery,
    zoom,
    isBlinking,
    onionOpacity,
    swipePos,
    highlightBoxes,
    openOverview,
    selectStoryById,
    setActiveStoryIndex,
    setActiveMode,
    setFilterStatus,
    setSearchQuery,
    setZoom,
    toggleBlink,
    setOnionOpacity,
    setSwipePos,
    setHighlightBoxes,
    goToNextStory,
    goToPrevStory,
  };

  return (
    <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
  );
};

export const useViewer = (): ViewerContextValue => {
  const ctx = useContext(ViewerContext);
  if (!ctx) {
    throw new Error('useViewer must be used within a ViewerProvider');
  }
  return ctx;
};
