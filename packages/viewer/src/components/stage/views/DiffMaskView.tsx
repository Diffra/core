import type React from 'react';
import { useEffect, useState } from 'react';
import { useViewer } from '../../../context/ViewerContext.js';
import { IconButton } from '../../ui/IconButton.js';
import { IconBlink, IconPause } from '../../ui/Icons.js';

export const DiffMaskView: React.FC = () => {
  const {
    activeStory,
    highlightBoxes,
    setHighlightBoxes,
    isBlinking,
    toggleBlink,
  } = useViewer();

  const [blinkShowCandidate, setBlinkShowCandidate] = useState(false);

  // Blink interval timer
  useEffect(() => {
    if (!isBlinking) {
      setBlinkShowCandidate(false);
      return;
    }

    const interval = setInterval(() => {
      setBlinkShowCandidate((prev) => !prev);
    }, 350);

    return () => clearInterval(interval);
  }, [isBlinking]);

  if (!activeStory) return null;

  const baseline = activeStory.baselineUrl || '';
  const candidate = activeStory.candidateUrl || '';
  const diff = activeStory.diffUrl || candidate;
  const boxes = activeStory.boundingBoxes || [];

  const displaySrc = isBlinking
    ? blinkShowCandidate
      ? candidate
      : baseline || diff
    : diff;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 gap-4 overflow-auto select-none">
      {/* Controls Bar */}
      <div className="flex items-center gap-3 bg-white/90 backdrop-blur border border-zinc-200/80 rounded-full px-4 py-1.5 text-xs text-zinc-700 font-medium shadow-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={highlightBoxes}
            onChange={(e) => setHighlightBoxes(e.target.checked)}
            className="cursor-pointer accent-rose-600 rounded"
          />
          <span className="font-semibold text-zinc-800">
            Diff Regions ({boxes.length})
          </span>
        </label>

        {baseline && candidate ? (
          <IconButton
            icon={
              isBlinking ? (
                <IconPause className="w-3.5 h-3.5" />
              ) : (
                <IconBlink className="w-3.5 h-3.5" />
              )
            }
            label={isBlinking ? 'Stop Blink' : 'Blink Mode'}
            shortcut="Space"
            active={isBlinking}
            onClick={toggleBlink}
          />
        ) : null}
      </div>

      {/* Image Stage */}
      <div className="relative inline-block overflow-hidden rounded-xl border border-zinc-200/80 bg-white canvas-backdrop max-w-full shadow-xs">
        <img
          src={displaySrc}
          alt="Diff Mask"
          className="block max-w-full h-auto pointer-events-none"
        />

        {/* Bounding Box Overlay */}
        {highlightBoxes && !isBlinking && boxes.length > 0 ? (
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            {boxes.map((b) => (
              <div
                key={`${b.minX}-${b.minY}-${b.maxX}-${b.maxY}`}
                className="diff-bounding-box"
                style={
                  {
                    '--box-x': `${b.minX}px`,
                    '--box-y': `${b.minY}px`,
                    '--box-w': `${b.maxX - b.minX + 1}px`,
                    '--box-h': `${b.maxY - b.minY + 1}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
