import type React from 'react';
import { Docks } from './Docks.js';
import { SnapshotView } from './SnapshotView.js';
import { TopBar } from './TopBar.js';

/** One snapshot, with the whole screen given to the image. */
export const Detail: React.FC = () => (
  <div className="h-full flex flex-col gap-6 px-10 pt-6 pb-10">
    <TopBar />
    <div className="relative flex-1 min-h-0 flex">
      <SnapshotView />
      <Docks />
    </div>
  </div>
);
