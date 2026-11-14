import type React from 'react';
import { CanvasLabel, Viewport } from '../Viewport.js';

/** One screenshot with a note about why there is nothing to compare it to. */
export const SingleView: React.FC<{
  src: string;
  alt: string;
  note: string;
}> = ({ src, alt, note }) => (
  <Viewport sourceUrl={src} overlay={<CanvasLabel>{note}</CanvasLabel>}>
    <div className="relative inline-block image-edge">
      <img
        src={src}
        alt={alt}
        className="block max-w-none pointer-events-none"
      />
    </div>
  </Viewport>
);
