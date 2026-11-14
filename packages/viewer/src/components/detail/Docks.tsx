import {
  Blend,
  ChevronDown,
  ChevronUp,
  Columns2,
  Diff,
  MoveHorizontal,
  Pause,
  Play,
} from 'lucide-react';
import type React from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import { ICON_CLASS, ICON_STROKE } from '../../tokens/icon.js';
import type { DiffMode, ZoomLevel } from '../../types/index.js';
import { IconButton } from '../ui/IconButton.js';
import { Segmented, type SegmentOption } from '../ui/Segmented.js';

const iconProps = { className: ICON_CLASS, strokeWidth: ICON_STROKE };

const MODE_OPTIONS: readonly SegmentOption<DiffMode>[] = [
  {
    id: 'diff',
    label: 'Diff',
    icon: <Diff {...iconProps} />,
    title: 'Diff (1)',
  },
  {
    id: 'split',
    label: 'Side by side',
    icon: <Columns2 {...iconProps} />,
    title: 'Side by side (2)',
  },
  {
    id: 'slide',
    label: 'Slide',
    icon: <MoveHorizontal {...iconProps} />,
    title: 'Slide (3)',
  },
  {
    id: 'fade',
    label: 'Fade',
    icon: <Blend {...iconProps} />,
    title: 'Fade (4)',
  },
];

const ZOOM_OPTIONS: readonly SegmentOption<ZoomLevel>[] = [
  { id: 'fit', label: 'Fit', title: 'Fit to width (f)' },
  { id: '100%', label: '100%', title: 'Actual size (+ and - to change)' },
  { id: '200%', label: '200%' },
  { id: '400%', label: '400%' },
];

/** A flat floating pill. A hairline ring stands in for a shadow. */
const Dock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="pointer-events-auto p-1.5 gap-1 rounded-full bg-paper outline outline-ink/10 flex items-center">
    {children}
  </div>
);

/**
 * The controls float over the canvas so the image can use the whole screen:
 * changed areas on the left, comparison in the middle, zoom on the right.
 */
export const Docks: React.FC = () => {
  const {
    activeStory,
    mode,
    setMode,
    regions,
    regionIndex,
    stepRegion,
    fade,
    setFade,
    isBlinking,
    toggleBlink,
    zoom,
    setZoom,
  } = useViewer();

  if (!activeStory) return null;
  const comparable = Boolean(
    activeStory.baselineUrl && activeStory.candidateUrl,
  );
  const hasImage =
    comparable || Boolean(activeStory.baselineUrl || activeStory.candidateUrl);
  if (!hasImage) return null;

  return (
    <div className="pointer-events-none absolute inset-x-6 bottom-6 flex flex-wrap items-end justify-center gap-3">
      {comparable && regions.length > 1 ? (
        <Dock>
          <span className="pl-4 pr-2 text-ink-2 tabular-nums">
            {regionIndex === null
              ? `${regions.length} changed areas`
              : `Area ${regionIndex + 1} of ${regions.length}`}
          </span>
          <IconButton
            icon={<ChevronUp {...iconProps} />}
            onClick={() => stepRegion(-1)}
            title="Previous changed area (p)"
            aria-label="Previous changed area"
          />
          <IconButton
            icon={<ChevronDown {...iconProps} />}
            onClick={() => stepRegion(1)}
            title="Next changed area (n)"
            aria-label="Next changed area"
          />
        </Dock>
      ) : null}

      {comparable ? (
        <Dock>
          <Segmented
            label="Comparison"
            value={mode}
            options={MODE_OPTIONS}
            onChange={setMode}
          />
          {mode === 'diff' ? (
            <span className="pl-3 pr-4 inline-flex items-center gap-2 text-ink-3">
              <span className="w-2 h-2 rounded-full bg-accent" />
              Changed pixels
            </span>
          ) : null}
          {mode === 'fade' ? (
            <>
              <input
                type="range"
                min={0}
                max={100}
                value={fade}
                onChange={(e) => setFade(Number(e.target.value))}
                disabled={isBlinking}
                aria-label="Candidate opacity"
                className="mx-3 w-32"
              />
              <IconButton
                icon={
                  isBlinking ? (
                    <Pause {...iconProps} />
                  ) : (
                    <Play {...iconProps} />
                  )
                }
                label="Blink"
                active={isBlinking}
                onClick={toggleBlink}
                title="Alternate between baseline and candidate (b)"
              />
            </>
          ) : null}
        </Dock>
      ) : null}

      <Dock>
        <Segmented
          label="Zoom"
          value={zoom}
          options={ZOOM_OPTIONS}
          onChange={setZoom}
        />
      </Dock>
    </div>
  );
};
