import type React from 'react';

export interface AreaChartProps {
  /** Unique per chart on a page, so the gradient ids never collide. */
  id: string;
  values: number[];
  labels: string[];
  width: number;
  height: number;
}

const PAD = { top: 16, right: 12, bottom: 28, left: 12 } as const;

/** A smooth revenue-style area chart with a baseline and month labels. */
export const AreaChart: React.FC<AreaChartProps> = ({
  id,
  values,
  labels,
  width,
  height,
}) => {
  const max = Math.max(...values) * 1.15;
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = height - PAD.top - PAD.bottom;
  const points = values.map((value, index) => ({
    x: PAD.left + (plotWidth / (values.length - 1)) * index,
    y: PAD.top + plotHeight * (1 - value / max),
  }));
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ');
  const area = `${line} L${PAD.left + plotWidth} ${PAD.top + plotHeight} L${PAD.left} ${PAD.top + plotHeight} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="Revenue over time"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f46e5" stopOpacity="0.32" />
          <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((fraction) => (
        <line
          key={fraction}
          x1={PAD.left}
          x2={PAD.left + plotWidth}
          y1={PAD.top + plotHeight * fraction}
          y2={PAD.top + plotHeight * fraction}
          stroke="#e2e8f0"
          strokeDasharray={fraction === 1 ? undefined : '4 6'}
        />
      ))}
      <path d={area} fill={`url(#${id}-fill)`} />
      <path
        d={line}
        fill="none"
        stroke="#4f46e5"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => (
        <g key={labels[index]}>
          <circle
            cx={point.x}
            cy={point.y}
            r="5"
            fill="#ffffff"
            stroke="#4f46e5"
            strokeWidth="3"
          />
          <text
            x={point.x}
            y={height - 8}
            textAnchor="middle"
            fontSize="13"
            fill="#64748b"
          >
            {labels[index]}
          </text>
        </g>
      ))}
    </svg>
  );
};
