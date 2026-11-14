import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import { useNaturalSize } from '../../hooks/useNaturalSize.js';
import type { ZoomLevel } from '../../types/index.js';

/** The label chips drawn in the corners of the canvas. */
export const CanvasLabel: React.FC<{
  align?: 'left' | 'right';
  children: React.ReactNode;
}> = ({ align = 'left', children }) => (
  <span
    className={`absolute top-4 ${
      align === 'left' ? 'left-4' : 'right-4'
    } h-8 px-4 rounded-full bg-paper text-ink-2 outline outline-ink/10 inline-flex items-center pointer-events-none select-none`}
  >
    {children}
  </span>
);

function percent(zoom: ZoomLevel): number {
  return Number.parseInt(zoom, 10) / 100;
}

export interface ViewportProps {
  /** The compared content. A function receives the current scale. */
  children: React.ReactNode | ((scale: number) => React.ReactNode);
  /** Any image of the snapshot. Its width decides how large "fit" is. */
  sourceUrl?: string;
  /** Labels and other chrome that stays put while the content scrolls. */
  overlay?: React.ReactNode;
  scrollRef?: React.Ref<HTMLDivElement>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

/**
 * The checkerboard surface every comparison draws on. It scrolls, applies the
 * shared zoom, and centres content that is smaller than the surface.
 */
export const Viewport: React.FC<ViewportProps> = ({
  children,
  sourceUrl,
  overlay,
  scrollRef,
  onScroll,
}) => {
  const { zoom } = useViewer();
  const size = useNaturalSize(sourceUrl);
  const node = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState(0);

  const setNode = useCallback(
    (element: HTMLDivElement | null) => {
      node.current = element;
      if (typeof scrollRef === 'function') scrollRef(element);
      else if (scrollRef) scrollRef.current = element;
    },
    [scrollRef],
  );

  useEffect(() => {
    const element = node.current;
    if (!element) return;
    const measure = () => {
      const content = element.firstElementChild;
      const padding = content
        ? Number.parseFloat(getComputedStyle(content).paddingLeft) * 2
        : 0;
      setAvailable(Math.max(0, element.clientWidth - padding));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // "Fit" shrinks large screenshots to the width of the surface, never enlarges.
  const scale =
    zoom === 'fit'
      ? size && available > 0
        ? Math.min(1, available / size.width)
        : 1
      : percent(zoom);

  return (
    <div className="relative w-full h-full min-h-0 min-w-0 rounded-3xl overflow-hidden canvas-backdrop select-none">
      <div
        ref={setNode}
        onScroll={onScroll}
        className="absolute inset-0 overflow-auto flex"
      >
        <div className="m-auto px-6 pt-16 pb-24">
          <div
            className={scale > 1 ? 'viewport-pixelated' : undefined}
            style={{ zoom: scale, '--inv': 1 / scale }}
          >
            {typeof children === 'function' ? children(scale) : children}
          </div>
        </div>
      </div>
      {overlay}
    </div>
  );
};
