import type React from 'react';

export interface BadgeProps {
  text: string;
  color?: 'green' | 'blue' | 'red';
}

export const Badge: React.FC<BadgeProps> = ({ text, color = 'green' }) => {
  const colorMap = {
    green: '#3fb950',
    blue: '#58a6ff',
    red: '#f85149',
  };

  const selectedColor = colorMap[color];

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: 600,
        background: 'rgba(63, 185, 80, 0.15)',
        color: selectedColor,
        border: `1px solid rgba(63, 185, 80, 0.3)`,
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: selectedColor,
          boxShadow: `0 0 8px ${selectedColor}`,
        }}
      />
      <span>{text}</span>
    </div>
  );
};
