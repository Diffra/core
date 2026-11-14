import type React from 'react';
import { useRef } from 'react';
import { useViewer } from '../../../context/ViewerContext.js';
import { ImageFrame } from '../ImageFrame.js';
import { CanvasLabel, Viewport } from '../Viewport.js';

/** Moves `to` to where `from` is. Returns whether anything moved. */
function mirrorScroll(from: HTMLElement, to: HTMLElement): boolean {
  if (to.scrollLeft === from.scrollLeft && to.scrollTop === from.scrollTop) {
    return false;
  }
  to.scrollLeft = from.scrollLeft;
  to.scrollTop = from.scrollTop;
  return true;
}

export const SplitView: React.FC = () => {
  const { activeStory } = useViewer();
  const left = useRef<HTMLDivElement | null>(null);
  const right = useRef<HTMLDivElement | null>(null);
  // The scroll event caused by mirroring must not be mirrored back.
  const mirroring = useRef(false);

  if (!activeStory?.baselineUrl || !activeStory.candidateUrl) return null;
  const { baselineUrl, candidateUrl } = activeStory;

  const follow =
    (
      source: React.RefObject<HTMLDivElement | null>,
      target: React.RefObject<HTMLDivElement | null>,
    ) =>
    () => {
      if (mirroring.current) {
        mirroring.current = false;
        return;
      }
      if (source.current && target.current) {
        mirroring.current = mirrorScroll(source.current, target.current);
      }
    };

  return (
    <div className="grid grid-cols-2 gap-4 w-full h-full min-h-0">
      <Viewport
        sourceUrl={baselineUrl}
        scrollRef={left}
        onScroll={follow(left, right)}
        overlay={<CanvasLabel>Baseline</CanvasLabel>}
      >
        <ImageFrame src={baselineUrl} alt="Baseline" />
      </Viewport>
      <Viewport
        sourceUrl={candidateUrl}
        scrollRef={right}
        onScroll={follow(right, left)}
        overlay={<CanvasLabel>Candidate</CanvasLabel>}
      >
        <ImageFrame src={candidateUrl} alt="Candidate" />
      </Viewport>
    </div>
  );
};
