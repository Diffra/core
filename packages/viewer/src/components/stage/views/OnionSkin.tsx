import type React from 'react';
import { useViewer } from '../../../context/ViewerContext.js';

export const OnionSkin: React.FC = () => {
  const { activeStory, onionOpacity } = useViewer();

  if (!activeStory) return null;

  const baseline = activeStory.baselineUrl || '';
  const candidate = activeStory.candidateUrl || '';

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-white border border-zinc-200/80 rounded-2xl overflow-auto canvas-backdrop min-h-0 w-full h-full select-none text-ui-base shadow-xs">
      <div
        className="relative inline-block overflow-hidden rounded-xl max-w-full"
        style={
          {
            '--onion-opacity': onionOpacity,
          } as React.CSSProperties
        }
      >
        {/* Baseline Base Layer */}
        <div className="block pointer-events-none">
          <img
            src={baseline || candidate}
            alt="Baseline"
            className="block max-w-full h-auto pointer-events-none"
          />
        </div>

        {/* Candidate Overlay with variable opacity */}
        <div className="onion-overlay-layer">
          <img
            src={candidate || baseline}
            alt="Candidate"
            className="block max-w-full h-auto pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
};
