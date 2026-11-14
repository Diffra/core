import type React from 'react';
import { baseText, palette, radius, type Tone, tones } from '../../theme';

export interface AlertProps {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  actionLabel?: string;
}

const ICON_PATHS: Record<Tone, string> = {
  success: 'M6 10.5l2.8 2.8L14.5 7.5',
  warning: 'M10 5.5v5.5M10 14.25h.01',
  danger: 'M7 7l6 6M13 7l-6 6',
  info: 'M10 9v5M10 6h.01',
};

const ROLES: Record<Tone, 'status' | 'alert'> = {
  success: 'status',
  info: 'status',
  warning: 'alert',
  danger: 'alert',
};

export const Alert: React.FC<AlertProps> = ({
  tone = 'info',
  title,
  children,
  actionLabel,
}) => {
  const colors = tones[tone];
  return (
    <div
      role={ROLES[tone]}
      style={{
        ...baseText,
        width: '100%',
        maxWidth: '480px',
        display: 'flex',
        gap: '12px',
        padding: '14px 16px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.medium,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke={colors.fg}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: '1px' }}
      >
        <circle cx="10" cy="10" r="8.5" />
        <path d={ICON_PATHS[tone]} />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <strong style={{ fontSize: '15px', fontWeight: 600 }}>{title}</strong>
        {children && (
          <span
            style={{
              fontSize: '14px',
              lineHeight: 1.5,
              color: palette.textMuted,
            }}
          >
            {children}
          </span>
        )}
        {actionLabel && (
          <span
            style={{
              marginTop: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: colors.fg,
            }}
          >
            {actionLabel}
          </span>
        )}
      </div>
    </div>
  );
};
