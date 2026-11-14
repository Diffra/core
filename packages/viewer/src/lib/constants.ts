import type { DiffMode, ZoomLevel } from '../types/index.js';

export const DEFAULT_MODE: DiffMode = 'diff';

export const DIFF_MODES: readonly DiffMode[] = [
  'diff',
  'split',
  'slide',
  'fade',
];

/** Zoom steps in order. The zoom keys move along this list. */
export const ZOOM_LEVELS: readonly ZoomLevel[] = [
  'fit',
  '100%',
  '200%',
  '400%',
];

export const DEFAULT_ZOOM: ZoomLevel = 'fit';

/** Share of the candidate shown when the fade starts, in percent. */
export const DEFAULT_FADE = 50;

/** Position of the slide divider when it starts, in percent. */
export const DEFAULT_SLIDE = 50;

/** How far the bracket keys and arrow keys move a slider, in percent. */
export const SLIDER_STEP = 5;

export const BLINK_INTERVAL_MS = 500;

/** How long the "Copied" confirmation stays visible. */
export const COPIED_FEEDBACK_MS = 1600;

/** Number of characters shown for a commit hash. */
export const SHORT_COMMIT_LENGTH = 7;
