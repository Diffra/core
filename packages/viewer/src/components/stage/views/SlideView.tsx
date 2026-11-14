import { MoveHorizontal } from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { useViewer } from '../../../context/ViewerContext.js';
import { SLIDER_STEP } from '../../../lib/constants.js';
import { ICON_CLASS, ICON_STROKE } from '../../../tokens/icon.js';
import { RegionOverlay } from '../RegionOverlay.js';
import { CanvasLabel, Viewport } from '../Viewport.js';

/** Baseline on the left of a draggable divider, candidate on the right. */
export const SlideView: React.FC = () => {
  const { activeStory, slide, setSlide } = useViewer();
  const frame = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  if (!activeStory?.baselineUrl || !activeStory.candidateUrl) return null;
  const { baselineUrl, candidateUrl } = activeStory;

  const moveTo = (clientX: number) => {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = (clientX - rect.left) / rect.width;
    setSlide(Math.round(Math.max(0, Math.min(1, ratio)) * 100));
  };

  return (
    <Viewport
      sourceUrl={candidateUrl}
      overlay={
        <>
          <CanvasLabel>Baseline</CanvasLabel>
          <CanvasLabel align="right">Candidate</CanvasLabel>
        </>
      }
    >
      <div
        ref={frame}
        role="slider"
        tabIndex={0}
        aria-label="Divider between baseline and candidate"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={slide}
        className={`relative inline-block image-edge touch-none ${
          dragging ? 'cursor-grabbing' : 'cursor-ew-resize'
        }`}
        style={{ '--slide-pos': `${slide}%` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          moveTo(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging) moveTo(e.clientX);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setSlide(Math.max(0, slide - SLIDER_STEP));
          if (e.key === 'ArrowRight')
            setSlide(Math.min(100, slide + SLIDER_STEP));
        }}
      >
        <img
          src={baselineUrl}
          alt="Baseline"
          className="block max-w-none pointer-events-none"
        />
        <div className="slide-clip-layer">
          <img
            src={candidateUrl}
            alt="Candidate"
            className="block max-w-none pointer-events-none"
          />
        </div>
        <RegionOverlay />
        <div className="slide-divider">
          <span className="slide-handle rounded-full bg-accent text-white flex items-center justify-center">
            <MoveHorizontal className={ICON_CLASS} strokeWidth={ICON_STROKE} />
          </span>
        </div>
      </div>
    </Viewport>
  );
};
