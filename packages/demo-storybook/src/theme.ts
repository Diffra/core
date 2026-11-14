import type React from 'react';

/** The font stack shared by every demo component. */
export const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** Design tokens shared by the demo components, so a token change is one edit. */
export const palette = {
  canvas: '#0d1117',
  surface: '#161b22',
  raised: '#21262d',
  border: '#30363d',
  text: '#f0f6fc',
  textMuted: '#8b949e',
  accent: '#58a6ff',
  accentStrong: '#0969da',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149',
} as const;

export const tones = {
  success: {
    fg: palette.success,
    bg: 'rgba(63, 185, 80, 0.12)',
    border: 'rgba(63, 185, 80, 0.4)',
  },
  warning: {
    fg: palette.warning,
    bg: 'rgba(210, 153, 34, 0.12)',
    border: 'rgba(210, 153, 34, 0.4)',
  },
  danger: {
    fg: palette.danger,
    bg: 'rgba(248, 81, 73, 0.12)',
    border: 'rgba(248, 81, 73, 0.4)',
  },
  info: {
    fg: palette.accent,
    bg: 'rgba(88, 166, 255, 0.12)',
    border: 'rgba(88, 166, 255, 0.4)',
  },
} as const;

export type Tone = keyof typeof tones;

export const radius = { small: '6px', medium: '10px', pill: '999px' } as const;

/** Text defaults for a component's outermost element. */
export const baseText: React.CSSProperties = {
  fontFamily,
  color: palette.text,
  boxSizing: 'border-box',
};

/** The rounded dark panel most components sit on. */
export const panel: React.CSSProperties = {
  ...baseText,
  background: palette.surface,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.medium,
};
