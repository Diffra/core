import type React from 'react';
import { useViewer } from '../../../context/ViewerContext.js';

export const OnionSkin: React.FC = () => {
  const { manifest, activeStory, onionOpacity, setOnionOpacity } = useViewer();

  if (!activeStory) return null;

  const baseline = activeStory.baselineUrl || '';
  const candidate = activeStory.candidateUrl || '';
  const baselineBranch = manifest.baselineBranch || 'main';
  const candidateBranch = manifest.branch || 'current';

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 gap-4 overflow-auto select-none">
      {/* Opacity Controls Bar */}
      <div className="flex items-center gap-3 bg-white/90 backdrop-blur border border-zinc-200/80 rounded-full px-4 py-1.5 text-xs text-zinc-700 font-medium shadow-xs">
        <span className="font-semibold text-zinc-800">
          Baseline ({baselineBranch})
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={onionOpacity}
          onChange={(e) => setOnionOpacity(parseFloat(e.target.value))}
          className="cursor-pointer accent-zinc-900 w-36"
        />
        <span className="font-semibold text-zinc-800">
          Candidate ({candidateBranch})
        </span>
        <span className="font-mono text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded text-xs font-semibold border border-zinc-200/60">
          {Math.round(onionOpacity * 100)}%
        </span>
      </div>

      {/* Stacked Images Stage */}
      <div
        className="relative inline-block overflow-hidden rounded-xl border border-zinc-200/80 bg-white canvas-backdrop max-w-full shadow-xs"
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
