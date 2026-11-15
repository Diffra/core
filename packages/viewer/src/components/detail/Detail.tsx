import type React from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import { Docks } from './Docks.js';
import { SnapshotView } from './SnapshotView.js';
import { TopBar } from './TopBar.js';

/** What in the page caused the change, in one sentence, when that is known. */
const Why: React.FC = () => {
  const { activeStory } = useViewer();
  const { why, classification } = activeStory ?? {};
  if (!why && !classification) return null;
  const lead =
    classification?.kind === 'intended'
      ? 'Intended. '
      : classification?.kind === 'collateral'
        ? 'Not intended. '
        : '';
  return (
    <p className="text-ui-base text-ink-2 -mt-3">
      {lead}
      {why ?? classification?.reason}
    </p>
  );
};

/** One snapshot, with the whole screen given to the image. */
export const Detail: React.FC = () => (
  <div className="h-full flex flex-col gap-6 px-10 pt-6 pb-10">
    <TopBar />
    <Why />
    <div className="relative flex-1 min-h-0 flex">
      <SnapshotView />
      <Docks />
    </div>
  </div>
);
