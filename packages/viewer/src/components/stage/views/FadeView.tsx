import type React from 'react';
import { useEffect, useState } from 'react';
import { useViewer } from '../../../context/ViewerContext.js';
import { BLINK_INTERVAL_MS } from '../../../lib/constants.js';
import { RegionOverlay } from '../RegionOverlay.js';
import { CanvasLabel, Viewport } from '../Viewport.js';

/**
 * The candidate laid over the baseline. The fade slider blends between them,
 * and blinking flips between the two, which is how small shifts show up.
 */
export const FadeView: React.FC = () => {
  const { activeStory, fade, isBlinking } = useViewer();
  const [showCandidate, setShowCandidate] = useState(true);

  useEffect(() => {
    if (!isBlinking) return;
    const timer = setInterval(
      () => setShowCandidate((shown) => !shown),
      BLINK_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [isBlinking]);

  if (!activeStory?.baselineUrl || !activeStory.candidateUrl) return null;
  const { baselineUrl, candidateUrl } = activeStory;

  const opacity = isBlinking ? (showCandidate ? 1 : 0) : fade / 100;
  const label = isBlinking
    ? showCandidate
      ? 'Candidate'
      : 'Baseline'
    : `${fade}% candidate`;

  return (
    <Viewport
      sourceUrl={candidateUrl}
      overlay={<CanvasLabel>{label}</CanvasLabel>}
    >
      <div
        className="relative inline-block image-edge"
        style={{ '--fade-opacity': opacity }}
      >
        <img
          src={baselineUrl}
          alt="Baseline"
          className="block max-w-none pointer-events-none"
        />
        <div className="fade-layer">
          <img
            src={candidateUrl}
            alt="Candidate"
            className="block max-w-none pointer-events-none"
          />
        </div>
        <RegionOverlay />
      </div>
    </Viewport>
  );
};
