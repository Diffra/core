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
  shortcut,
  active = false,
  className = '',
  ...props
}) => {
  const activeClass = active
    ? 'bg-white text-zinc-900 shadow-xs border-zinc-200/80 font-semibold'
    : 'bg-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 border-transparent font-medium';

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 border rounded-md px-2.5 py-1 text-xs font-sans cursor-pointer transition-all duration-150 outline-none select-none ${activeClass} ${className}`}
      {...props}
    >
      {icon}
      {label ? <span>{label}</span> : null}
      {shortcut ? (
        <span className="font-mono text-[10px] text-zinc-400 bg-zinc-100 px-1 py-0.2 rounded border border-zinc-200">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
};
