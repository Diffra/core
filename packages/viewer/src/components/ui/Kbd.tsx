import type React from 'react';

/** A keyboard key. Set in the interface font like all other text. */
export const Kbd: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = 'bg-wash' }) => (
  <kbd
    className={`min-w-6 h-6 px-1.5 rounded-md text-ink-3 inline-flex items-center justify-center ${className}`}
  >
    {children}
  </kbd>
);
