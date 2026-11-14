import type React from 'react';
import { RegionOverlay } from './RegionOverlay.js';

/** One screenshot at its natural size, with the region outline on top. */
export const ImageFrame: React.FC<{ src: string; alt: string }> = ({
  src,
  alt,
}) => (
  <div className="relative inline-block image-edge">
    <img src={src} alt={alt} className="block max-w-none pointer-events-none" />
    <RegionOverlay />
  </div>
);
