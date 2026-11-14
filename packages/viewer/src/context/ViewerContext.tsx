import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useHashLocation } from 'wouter/use-hash-location';
import {
  DEFAULT_FADE,
  DEFAULT_MODE,
  DEFAULT_SLIDE,
  DEFAULT_ZOOM,
  ZOOM_LEVELS,
} from '../lib/constants.js';
import { stepIndex } from '../lib/navigation.js';
import {
  availableFilters,
  buildReviewList,
  flattenGroups,
  type ReviewFilter,
  type ReviewGroup,
} from '../lib/review-list.js';
import { buildRoute, parseRoute } from '../lib/route.js';
import type {
  BoundingBox,
  DiffMode,
  TestResult,
  TestRunReport,
  ZoomLevel,
} from '../types/index.js';

interface ViewerContextValue {
  manifest: TestRunReport;

  /** The snapshot being inspected, or null on the overview. */
  activeStory: TestResult | null;
  mode: DiffMode;

  /** Sidebar content: filtered, sorted and grouped. */
  groups: ReviewGroup[];
  /** The same snapshots as a flat list, in sidebar order. */
  ordered: TestResult[];
  /** Position of the active snapshot in `ordered`, or -1 when it is hidden. */
  position: number;
  /** The filters worth offering for this run. */
  filters: ReviewFilter[];

  query: string;
  filter: ReviewFilter;
  /** Bumps each time something asks for the search to be focused. */
  searchTick: number;
  zoom: ZoomLevel;
  fade: number;
  slide: number;
  isBlinking: boolean;

  regions: BoundingBox[];
  /** The region being inspected, or null until the reviewer steps to one. */
  regionIndex: number | null;

  openOverview: () => void;
  openSnapshot: (id: string) => void;
  setMode: (mode: DiffMode) => void;
  stepSnapshot: (direction: 1 | -1) => void;
  stepRegion: (direction: 1 | -1) => void;
  setQuery: (query: string) => void;
  setFilter: (filter: ReviewFilter) => void;
  requestSearch: () => void;
  setZoom: (zoom: ZoomLevel) => void;
  stepZoom: (direction: 1 | -1) => void;
  setFade: (value: number) => void;
  setSlide: (value: number) => void;
  toggleBlink: () => void;
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
  const [location, navigate] = useHashLocation();

  const results = manifest.results;

  const route = useMemo(
    () => parseRoute(location, (id) => results.some((r) => r.id === id)),
    [location, results],
  );

  const activeStory = useMemo(
    () =>
      route.kind === 'snapshot'
        ? (results.find((r) => r.id === route.id) ?? null)
        : null,
    [route, results],
  );
  const mode = route.kind === 'snapshot' ? route.mode : DEFAULT_MODE;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ReviewFilter>('review');
  const [searchTick, setSearchTick] = useState(0);
  const [zoom, setZoom] = useState<ZoomLevel>(DEFAULT_ZOOM);
  const [fade, setFade] = useState(DEFAULT_FADE);
  const [slide, setSlide] = useState(DEFAULT_SLIDE);
  const [isBlinking, setIsBlinking] = useState(false);
  const [regionState, setRegionState] = useState<{
    id: string;
    index: number | null;
  }>({ id: '', index: null });

  const groups = useMemo(
    () => buildReviewList(results, { query, filter }),
    [results, query, filter],
  );
  const ordered = useMemo(() => flattenGroups(groups), [groups]);
  const position = activeStory
    ? ordered.findIndex((r) => r.id === activeStory.id)
    : -1;
  const filters = useMemo(() => availableFilters(results), [results]);
  const requestSearch = useCallback(
    () => setSearchTick((tick) => tick + 1),
    [],
  );

  const regions = activeStory?.boundingBoxes ?? [];
  const regionIndex =
    activeStory && regionState.id === activeStory.id ? regionState.index : null;

  const openOverview = useCallback(() => {
    navigate(buildRoute({ kind: 'overview' }));
  }, [navigate]);

  const openSnapshot = useCallback(
    (id: string) => {
      navigate(buildRoute({ kind: 'snapshot', id, mode }));
    },
    [navigate, mode],
  );

  const setMode = useCallback(
    (next: DiffMode) => {
      if (!activeStory) return;
      if (next !== 'fade') setIsBlinking(false);
      // Changing the mode refines the current view, so it replaces history.
      navigate(
        buildRoute({ kind: 'snapshot', id: activeStory.id, mode: next }),
        {
          replace: true,
        },
      );
    },
    [navigate, activeStory],
  );

  const stepSnapshot = useCallback(
    (direction: 1 | -1) => {
      const next = stepIndex(position, ordered.length, direction);
      const target = next === null ? undefined : ordered[next];
      if (target) openSnapshot(target.id);
    },
    [position, ordered, openSnapshot],
  );

  const stepRegion = useCallback(
    (direction: 1 | -1) => {
      if (!activeStory) return;
      const next = stepIndex(regionIndex, regions.length, direction);
      setRegionState({ id: activeStory.id, index: next });
    },
    [activeStory, regionIndex, regions.length],
  );

  const stepZoom = useCallback(
    (direction: 1 | -1) => {
      const current = ZOOM_LEVELS.indexOf(zoom);
      const next = Math.min(
        ZOOM_LEVELS.length - 1,
        Math.max(0, current + direction),
      );
      setZoom(ZOOM_LEVELS[next] ?? DEFAULT_ZOOM);
    },
    [zoom],
  );

  const toggleBlink = useCallback(() => {
    if (!activeStory) return;
    if (mode !== 'fade') {
      setMode('fade');
      setIsBlinking(true);
      return;
    }
    setIsBlinking((prev) => !prev);
  }, [activeStory, mode, setMode]);

  const value: ViewerContextValue = {
    manifest,
    activeStory,
    mode,
    groups,
    ordered,
    position,
    filters,
    query,
    filter,
    searchTick,
    zoom,
    fade,
    slide,
    isBlinking,
    regions,
    regionIndex,
    openOverview,
    openSnapshot,
    setMode,
    stepSnapshot,
    stepRegion,
    setQuery,
    setFilter,
    requestSearch,
    setZoom,
    stepZoom,
    setFade,
    setSlide,
    toggleBlink,
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
