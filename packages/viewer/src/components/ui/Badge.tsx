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
      changed: 'bg-amber-100/90 text-amber-900',
      added: 'bg-emerald-100/90 text-emerald-900',
      removed: 'bg-rose-100/90 text-rose-900',
      unchanged: 'bg-zinc-200/60 text-zinc-700',
      default: 'bg-zinc-200/60 text-zinc-700',
    }[variant] || 'bg-zinc-200/60 text-zinc-700';

  const dotStyles =
    {
      changed: 'bg-amber-600',
      added: 'bg-emerald-600',
      removed: 'bg-rose-600',
      unchanged: 'bg-zinc-400',
      default: 'bg-zinc-400',
    }[variant] || 'bg-zinc-400';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-ui-label select-none capitalize border-none shrink-0 ${variantStyles} ${className}`}
    >
      {showDot && variant !== 'default' ? (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles}`} />
      ) : null}
      <span>{children}</span>
    </span>
  );
};
