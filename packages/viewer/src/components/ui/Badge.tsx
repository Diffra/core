import type React from 'react';

export interface BadgeProps {
  variant?: 'added' | 'changed' | 'removed' | 'unchanged' | 'default';
  children: React.ReactNode;
  className?: string;
  showDot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  className = '',
  showDot = true,
}) => {
  const variantStyles =
    {
      changed: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
      added: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
      removed: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
      unchanged: 'bg-zinc-100 text-zinc-600 border-zinc-200/80',
      default: 'bg-zinc-100 text-zinc-700 border-zinc-200/80',
    }[variant] || 'bg-zinc-100 text-zinc-700 border-zinc-200/80';

  const dotStyles =
    {
      changed: 'bg-amber-500',
      added: 'bg-emerald-500',
      removed: 'bg-rose-500',
      unchanged: 'bg-zinc-400',
      default: 'bg-zinc-400',
    }[variant] || 'bg-zinc-400';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wider select-none leading-none border ${variantStyles} ${className}`}
    >
      {showDot && variant !== 'default' ? (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles}`} />
      ) : null}
      <span className="font-semibold">{children}</span>
    </span>
  );
};
