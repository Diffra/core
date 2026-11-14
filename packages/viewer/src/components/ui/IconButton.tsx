import type React from 'react';

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  /** Visible text. Without it the button is a round icon button. */
  label?: string;
  /** Marks a toggle that is switched on. */
  active?: boolean;
  /** `outline` draws a hairline ring, for the one primary action in a row. */
  variant?: 'ghost' | 'outline';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  active = false,
  variant = 'ghost',
  className = '',
  ...props
}) => (
  <button
    type="button"
    className={`h-10 ${
      label ? 'px-4 gap-2' : 'w-10 justify-center'
    } inline-flex items-center rounded-full border-none cursor-pointer select-none transition-colors disabled:opacity-40 disabled:cursor-default ${
      variant === 'outline'
        ? 'outline outline-ink/15 outline-offset-[-1px]'
        : ''
    } ${
      active
        ? 'bg-ink text-paper'
        : 'bg-transparent text-ink-2 hover:text-ink hover:bg-wash disabled:hover:bg-transparent disabled:hover:text-ink-2'
    } ${className}`}
    {...props}
  >
    {icon}
    {label}
  </button>
);
