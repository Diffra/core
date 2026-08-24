import type React from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import { StageToolbar } from './StageToolbar.js';
import { DiffMaskView } from './views/DiffMaskView.js';
import { GalleryView } from './views/GalleryView.js';
import { OnionSkin } from './views/OnionSkin.js';
import { SplitView } from './views/SplitView.js';
import { SwipeSlider } from './views/SwipeSlider.js';

export const Stage: React.FC = () => {
  const { viewMode, activeStory, activeMode } = useViewer();

  if (viewMode === 'overview' || !activeStory) {
    return (
      <main className="flex-1 flex flex-col h-full bg-zinc-50 overflow-hidden">
        <StageToolbar />
        <GalleryView />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col h-full bg-zinc-50 overflow-hidden">
      <StageToolbar />
      <div className="flex-1 relative overflow-hidden flex">
        {activeMode === 'split' ? (
          <SplitView />
        ) : activeMode === 'swipe' ? (
          <SwipeSlider />
        ) : activeMode === 'onion' ? (
          <OnionSkin />
        ) : (
          <DiffMaskView />
        )}
      </div>
    </main>
  );
};
