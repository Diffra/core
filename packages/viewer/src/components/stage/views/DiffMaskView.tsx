import type React from 'react';
import { useEffect, useState } from 'react';
import { useViewer } from '../../../context/ViewerContext.js';

export const DiffMaskView: React.FC = () => {
  const { activeStory, highlightBoxes, isBlinking } = useViewer();

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
    <div className="flex-1 flex items-center justify-center p-4 bg-white border border-zinc-200/80 rounded-2xl overflow-auto canvas-backdrop min-h-0 w-full h-full select-none text-ui-base shadow-xs">
      <div className="relative inline-block overflow-hidden rounded-xl max-w-full">
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
