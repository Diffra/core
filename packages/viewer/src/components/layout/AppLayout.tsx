import type React from 'react';
import { useViewer } from '../../context/ViewerContext.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';
import { Detail } from '../detail/Detail.js';
import { Home } from '../home/Home.js';

/** Two screens: the home page for triage, and one snapshot full-bleed. */
export const AppLayout: React.FC = () => {
  const { activeStory } = useViewer();

  useKeyboardShortcuts();

  return (
    <div className="w-screen h-screen bg-paper text-ink overflow-hidden">
      {activeStory ? <Detail /> : <Home />}
    </div>
  );
};
