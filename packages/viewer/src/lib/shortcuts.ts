export interface Shortcut {
  keys: string[];
  label: string;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

/** Shown in the help panel. Keep in step with useKeyboardShortcuts. */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'Navigate',
    shortcuts: [
      { keys: ['j', '↓'], label: 'Next snapshot' },
      { keys: ['k', '↑'], label: 'Previous snapshot' },
      { keys: ['o', 'Esc'], label: 'Back to overview' },
      { keys: ['/'], label: 'Search snapshots' },
    ],
  },
  {
    title: 'Compare',
    shortcuts: [
      { keys: ['1'], label: 'Diff' },
      { keys: ['2'], label: 'Side by side' },
      { keys: ['3'], label: 'Slide' },
      { keys: ['4'], label: 'Fade' },
      { keys: ['b'], label: 'Blink baseline and candidate' },
      { keys: ['[', ']'], label: 'Move the slider' },
      { keys: ['n', 'p'], label: 'Next and previous changed area' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: ['+', '-'], label: 'Zoom in and out' },
      { keys: ['f'], label: 'Fit to width' },
      { keys: ['?'], label: 'Show these shortcuts' },
    ],
  },
];
