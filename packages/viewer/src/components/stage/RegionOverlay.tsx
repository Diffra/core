import type React from 'react';
import { useEffect, useRef } from 'react';
import { useViewer } from '../../context/ViewerContext.js';

/**
 * Outlines the changed area the reviewer has stepped to and scrolls it into
 * view. Boxes are in image pixels, so the surrounding zoom scales them.
 */
export const RegionOverlay: React.FC = () => {
  const { regions, regionIndex } = useViewer();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (regionIndex === null) return;
    ref.current?.scrollIntoView({
      block: 'center',
      inline: 'center',
      behavior: 'smooth',
    });
  }, [regionIndex]);

  const region = regionIndex === null ? undefined : regions[regionIndex];
  if (!region) return null;

  return (
    <div
      ref={ref}
      className="region-outline"
      style={{
        '--box-x': `${region.minX}px`,
        '--box-y': `${region.minY}px`,
        '--box-w': `${region.maxX - region.minX + 1}px`,
        '--box-h': `${region.maxY - region.minY + 1}px`,
      }}
    />
  );
};
