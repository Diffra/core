import { useEffect, useRef } from 'react';
import { useViewer } from '../context/ViewerContext.js';
import { SLIDER_STEP } from '../lib/constants.js';

const MODE_KEYS = ['diff', 'split', 'slide', 'fade'] as const;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * Keyboard control for the whole review. The handler is bound once and reads
 * the latest viewer state through a ref.
 */
export function useKeyboardShortcuts() {
  const viewer = useViewer();
  const latest = useRef(viewer);
  latest.current = viewer;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const v = latest.current;

      if (isTyping(e.target)) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      const inSnapshot = v.activeStory !== null;

      switch (e.key) {
        case '/':
          e.preventDefault();
          v.requestSearch();
          break;
        case 'Escape':
        case 'o':
          if (inSnapshot) v.openOverview();
          break;
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          v.stepSnapshot(1);
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          v.stepSnapshot(-1);
          break;
        case '1':
        case '2':
        case '3':
        case '4': {
          const mode = MODE_KEYS[Number(e.key) - 1];
          if (inSnapshot && mode) v.setMode(mode);
          break;
        }
        case 'b':
          v.toggleBlink();
          break;
        case 'n':
          if (inSnapshot) v.stepRegion(1);
          break;
        case 'p':
          if (inSnapshot) v.stepRegion(-1);
          break;
        case '[':
          if (v.mode === 'slide')
            v.setSlide(Math.max(0, v.slide - SLIDER_STEP));
          if (v.mode === 'fade') v.setFade(Math.max(0, v.fade - SLIDER_STEP));
          break;
        case ']':
          if (v.mode === 'slide')
            v.setSlide(Math.min(100, v.slide + SLIDER_STEP));
          if (v.mode === 'fade') v.setFade(Math.min(100, v.fade + SLIDER_STEP));
          break;
        case '+':
        case '=':
          v.stepZoom(1);
          break;
        case '-':
          v.stepZoom(-1);
          break;
        case 'f':
          v.setZoom('fit');
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
