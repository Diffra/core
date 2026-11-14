import type React from 'react';

/**
 * Design tokens and base typography for every screen. Screens read colours
 * through these custom properties, as a real product would.
 */
export const UI_CSS = `
.dx-app {
  --brand-500: #4f46e5;
  --brand-600: #4338ca;
  --brand-100: #e0e7ff;
  --brand-50: #eef2ff;
  --ink-900: #0f172a;
  --ink-700: #334155;
  --ink-500: #64748b;
  --ink-300: #cbd5e1;
  --line: #e2e8f0;
  --page: #f6f7fb;
  --card: #ffffff;
  --success: #16a34a;
  --success-bg: #dcfce7;
  --danger: #dc2626;
  --danger-bg: #fee2e2;
  --warning: #d97706;
  --warning-bg: #fef3c7;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--ink-900);
  background: var(--page);
  -webkit-font-smoothing: antialiased;
}
.dx-app[data-theme='dark'] {
  --page: #0a0f1f;
  --card: #121a30;
  --ink-900: #f1f5f9;
  --ink-700: #cbd5e1;
  --ink-500: #94a3b8;
  --ink-300: #475569;
  --line: #25304d;
  --brand-50: #1b2150;
  --brand-100: #2a3170;
}
.dx-app *, .dx-app *::before, .dx-app *::after { box-sizing: border-box; }
.dx-app h1, .dx-app h2, .dx-app h3, .dx-app p, .dx-app ul { margin: 0; padding: 0; }
.dx-app button, .dx-app input { font-family: inherit; }
`;

export interface AppFrameProps {
  children: React.ReactNode;
  theme?: 'light' | 'dark';
  style?: React.CSSProperties;
}

/** A full-viewport page that every screen story renders inside. */
export const AppFrame: React.FC<AppFrameProps> = ({
  children,
  theme = 'light',
  style,
}) => (
  <div
    className="dx-app"
    data-theme={theme}
    style={{ position: 'relative', minHeight: '100vh', ...style }}
  >
    <style>{UI_CSS}</style>
    {children}
  </div>
);

const ICON_PATHS = {
  check: 'M20 6 9 17l-5-5',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  users:
    'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h8',
  plug: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0ZM12 18v4',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
  calendar:
    'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z',
  star: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  alert:
    'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export const Icon: React.FC<{
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}> = ({ name, size = 20, color = 'currentColor', strokeWidth = 2 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <path d={ICON_PATHS[name]} />
  </svg>
);

export const Logo: React.FC<{
  name: string;
  color?: string;
  accent?: string;
}> = ({ name, color = 'var(--ink-900)', accent = 'var(--brand-500)' }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 22,
      fontWeight: 800,
      letterSpacing: '-0.02em',
      color,
    }}
  >
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <rect width="30" height="30" rx="9" fill={accent} />
      <path d="M15 6.5 23.5 15 15 23.5 6.5 15Z" fill="#ffffff" opacity="0.95" />
    </svg>
    {name}
  </span>
);

/** A round avatar showing initials on a stable colour. */
export const Person: React.FC<{
  name: string;
  size?: number;
  color: string;
}> = ({ name, size = 36, color }) => (
  <span
    role="img"
    aria-label={name}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      color: '#ffffff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.round(size * 0.38),
      fontWeight: 700,
      flexShrink: 0,
    }}
  >
    {name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')}
  </span>
);
