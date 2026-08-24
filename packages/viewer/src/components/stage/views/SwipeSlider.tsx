import type React from 'react';
import { useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useViewer } from '../../../context/ViewerContext.js';

export const SwipeSlider: React.FC = () => {
  const { activeStory, swipePos, setSwipePos } = useViewer();
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!activeStory) return null;

  const baseline = activeStory.baselineUrl || '';
  const candidate = activeStory.candidateUrl || '';

  const handleUpdate = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
    setSwipePos(Math.round(percent));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleUpdate(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleUpdate(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-white border border-zinc-200/80 rounded-2xl overflow-auto canvas-backdrop min-h-0 w-full h-full select-none text-ui-base shadow-xs">
      <div
        ref={containerRef}
        role="slider"
        tabIndex={0}
        aria-label="Visual swipe comparison slider"
        aria-valuenow={swipePos}
        aria-valuemin={0}
        aria-valuemax={100}
        onMouseDown={handleMouseDown}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            setSwipePos(Math.max(0, swipePos - 5));
          } else if (e.key === 'ArrowRight') {
            setSwipePos(Math.min(100, swipePos + 5));
          }
        }}
        className={`relative inline-block overflow-hidden rounded-xl outline-none max-w-full ${
          isDragging ? 'cursor-ew-resize' : 'cursor-default'
        }`}
        style={
          {
            '--swipe-pos': `${swipePos}%`,
          } as React.CSSProperties
        }
      >
        {/* Baseline (Underneath / Left) */}
        <div className="block pointer-events-none">
          <img
            src={baseline || candidate}
            alt="Baseline"
            className="block max-w-full h-auto pointer-events-none"
          />
        </div>

        {/* Candidate (Top / Right clip) */}
        <div className="swipe-clip-layer">
          <img
            src={candidate || baseline}
            alt="Candidate"
            className="block max-w-full h-auto pointer-events-none"
          />
        </div>

        {/* Slider Divider Handle */}
        <div className="swipe-divider-line">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center pointer-events-auto cursor-ew-resize border border-zinc-700 hover:bg-zinc-800 transition-colors shadow-sm">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
