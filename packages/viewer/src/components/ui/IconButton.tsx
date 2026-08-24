import type React from 'react';

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  label?: string;
  shortcut?: string;
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  active = false,
  className = '',
  ...props
}) => {
  const activeClass = active
    ? 'bg-white text-zinc-900 font-medium'
    : 'bg-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 font-normal';

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 border-none rounded-md px-3 py-1.5 text-ui-medium cursor-pointer transition-all duration-150 outline-none select-none ${activeClass} ${className}`}
      {...props}
    >
      {icon}
      {label ? <span>{label}</span> : null}
    </button>
  );
};
