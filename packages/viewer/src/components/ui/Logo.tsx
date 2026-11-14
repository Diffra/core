import type React from 'react';

/** The Diffra mark: a square split into what was and what is. */
export const Logo: React.FC = () => (
  <span className="inline-flex items-center gap-2.5 text-ink">
    <svg
      className="w-5 h-5"
      viewBox="0 0 20 20"
      fill="none"
      role="img"
      aria-label="Diffra"
    >
      <rect
        x="1"
        y="1"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10 1h4a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-4z"
        fill="var(--color-accent)"
      />
    </svg>
    <span className="text-ui-heading">Diffra</span>
  </span>
);
