import type React from 'react';

export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  onClick,
}) => {
  const baseStyle: React.CSSProperties = {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '15px',
    fontWeight: 700,
    padding: '12px 24px',
    borderRadius: '12px',
    cursor: 'pointer',
    border: '1px solid transparent',
    width: fullWidth ? '100%' : 'auto',
    transition: 'background 0.15s ease',
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    small: { padding: '8px 16px', fontSize: '13px' },
    medium: { padding: '12px 24px', fontSize: '15px' },
    large: { padding: '16px 32px', fontSize: '17px' },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: '#10b981',
      color: '#ffffff',
      borderColor: '#059669',
      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
    },
    secondary: {
      background: '#1f293d',
      color: '#c9d1d9',
      borderColor: '#388bfd',
    },
    danger: {
      background: '#dc2626',
      color: '#ffffff',
      borderColor: '#b91c1c',
    },
  };

  return (
    <button
      type="button"
      className={`btn btn-${variant}`}
      style={{
        ...baseStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
};
