import type React from 'react';

export interface CardProps {
  title: string;
  description: string;
  badge?: string;
  tag?: string;
  featured?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  description,
  badge,
  tag,
  featured = false,
}) => {
  const displayBadge = badge || tag;
  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: featured
          ? 'linear-gradient(180deg, #1f283d 0%, #161b22 100%)'
          : '#161b22',
        border: `1px solid ${featured ? '#58a6ff' : '#30363d'}`,
        borderRadius: '8px',
        padding: '24px',
        width: '360px',
        boxShadow: featured
          ? '0 8px 24px rgba(56, 139, 253, 0.2)'
          : '0 4px 16px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        color: '#f0f6fc',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '18px', fontWeight: 600 }}>{title}</span>
        {displayBadge && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              background: 'rgba(56, 139, 253, 0.2)',
              color: '#58a6ff',
              padding: '2px 8px',
              borderRadius: '12px',
              border: '1px solid rgba(56, 139, 253, 0.3)',
            }}
          >
            {displayBadge}
          </span>
        )}
      </div>
      <p
        style={{
          fontSize: '13px',
          color: '#8b949e',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );
};
