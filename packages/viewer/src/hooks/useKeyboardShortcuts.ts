import { useEffect } from 'react';
import { useViewer } from '../context/ViewerContext.js';

export function useKeyboardShortcuts(
  searchInputRef?: React.RefObject<HTMLInputElement | null>,
) {
  const {
    openOverview,
    setActiveMode,
    goToNextStory,
    goToPrevStory,
    toggleBlink,
    activeMode,
    viewMode,
  } = useViewer();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (e.key === '/' && !isInput && searchInputRef?.current) {
        e.preventDefault();
        searchInputRef.current.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (isInput && searchInputRef?.current) {
          searchInputRef.current.blur();
          return;
        }
        if (viewMode === 'detail') {
          openOverview();
          return;
        }
      }

      if (isInput) return;

      switch (e.key) {
        case '0':
        case 'o':
          openOverview();
          break;
        case '1':
          setActiveMode('highlight');
          break;
        case '2':
          setActiveMode('split');
          break;
        case '3':
          setActiveMode('swipe');
          break;
        case '4':
          setActiveMode('onion');
          break;
        case '5':
          setActiveMode('mask');
          break;
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          goToNextStory();
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          goToPrevStory();
          break;
        case ' ':
          if (viewMode === 'detail' && activeMode === 'mask') {
            e.preventDefault();
            toggleBlink();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    openOverview,
    setActiveMode,
    goToNextStory,
    goToPrevStory,
    toggleBlink,
    activeMode,
    viewMode,
    searchInputRef,
  ]);
}
