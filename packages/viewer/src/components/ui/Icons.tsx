import type React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const IconOverview: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
);

export const IconSplit: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="2" y="2" width="12" height="12" rx="2" />
    <line x1="8" y1="2" x2="8" y2="14" />
  </svg>
);

export const IconSwipe: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="2" y="2" width="12" height="12" rx="2" />
    <line x1="7" y1="2" x2="7" y2="14" />
    <path d="M5 8l-2 0m0 0l1 -1m-1 1l1 1" />
    <path d="M9 8l2 0m0 0l-1 -1m1 1l-1 1" />
  </svg>
);

export const IconOnion: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="2" y="2" width="9" height="9" rx="1.5" strokeOpacity="0.5" />
    <rect x="5" y="5" width="9" height="9" rx="1.5" />
  </svg>
);

export const IconMask: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="8" cy="8" r="6" />
    <circle cx="8" cy="8" r="2.5" />
    <line x1="8" y1="1" x2="8" y2="3" />
    <line x1="8" y1="13" x2="8" y2="15" />
    <line x1="1" y1="8" x2="3" y2="8" />
    <line x1="13" y1="8" x2="15" y2="8" />
  </svg>
);

export const IconSearch: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="7" cy="7" r="4.5" />
    <line x1="10.5" y1="10.5" x2="14" y2="14" />
  </svg>
);

export const IconClose: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <line x1="4" y1="4" x2="12" y2="12" />
    <line x1="12" y1="4" x2="4" y2="12" />
  </svg>
);

export const IconChevronLeft: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <polyline points="10 3 5 8 10 13" />
  </svg>
);

export const IconChevronRight: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <polyline points="6 3 11 8 6 13" />
  </svg>
);

export const IconBlink: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" />
    <circle cx="8" cy="8" r="2.5" />
  </svg>
);

export const IconPlay: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <polygon points="5 3 13 8 5 13 5 3" />
  </svg>
);

export const IconPause: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
    <rect x="4" y="3" width="3" height="10" rx="0.5" />
    <rect x="9" y="3" width="3" height="10" rx="0.5" />
  </svg>
);
