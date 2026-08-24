import type React from 'react';
import { useRef, useState } from 'react';
import { useViewer } from '../../../context/ViewerContext.js';
import { IconSwipe } from '../../ui/Icons.js';

export const SwipeSlider: React.FC = () => {
  const { manifest, activeStory, swipePos, setSwipePos } = useViewer();
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!activeStory) return null;

  const baseline = activeStory.baselineUrl || '';
  const candidate = activeStory.candidateUrl || '';
  const baselineBranch = manifest.baselineBranch || 'main';
  const candidateBranch = manifest.branch || 'current';

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
    <div className="flex flex-col items-center justify-center w-full h-full p-6 gap-4 overflow-auto select-none">
      {/* Position Pill */}
      <div className="flex items-center gap-3 bg-white/90 backdrop-blur border border-zinc-200/80 rounded-full px-4 py-1.5 text-xs text-zinc-700 font-medium shadow-xs">
        <span className="font-semibold text-zinc-800">
          Baseline ({baselineBranch})
        </span>
        <span className="font-mono text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded text-xs font-semibold border border-zinc-200/60">
          {swipePos}%
        </span>
        <span className="font-semibold text-zinc-800">
          Candidate ({candidateBranch})
        </span>
      </div>

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
        className={`relative inline-block overflow-hidden rounded-xl border border-zinc-200/80 bg-white canvas-backdrop outline-none max-w-full shadow-xs ${
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center pointer-events-auto cursor-ew-resize shadow-md hover:bg-zinc-800 transition-colors">
            <IconSwipe className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
