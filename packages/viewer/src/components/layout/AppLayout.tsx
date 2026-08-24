import type React from 'react';
import { useRef } from 'react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';
import { Stage } from '../stage/Stage.js';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';

export const AppLayout: React.FC = () => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts(searchInputRef);

  return (
    <div className="flex flex-col w-screen h-screen bg-white text-zinc-900 overflow-hidden font-sans">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar searchInputRef={searchInputRef} />
        <Stage />
      </div>
    </div>
  );
};
