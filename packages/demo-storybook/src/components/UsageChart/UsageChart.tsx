import type React from 'react';
import { baseText, fontFamily, palette, panel } from '../../theme';

export interface UsagePoint {
  label: string;
  value: number;
}

export interface UsageChartProps {
  title: string;
  data: UsagePoint[];
  emptyMessage?: string;
}

const WIDTH = 520;
const HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 32, left: 48 } as const;
const TICK_COUNT = 4;
const BAR_FILL_RATIO = 0.6;
const BAR_RADIUS = 4;

const compact = new Intl.NumberFormat('en-US', { notation: 'compact' });

/** Rounds the data maximum up to 1, 2, 2.5 or 5 times a power of ten. */
export function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;
  const step = [1, 2, 2.5, 5, 10].find((candidate) => normalized <= candidate);
  return (step ?? 10) * magnitude;
}

export const UsageChart: React.FC<UsageChartProps> = ({
  title,
  data,
  emptyMessage = 'No usage recorded for this period.',
}) => {
  const hasData = data.some((point) => point.value > 0);
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const ceiling = niceCeiling(Math.max(0, ...data.map((p) => p.value)));
  const slot = plotWidth / Math.max(1, data.length);
  const barWidth = slot * BAR_FILL_RATIO;
  const ticks = Array.from(
    { length: TICK_COUNT + 1 },
    (_, step) => (ceiling / TICK_COUNT) * step,
  );
  const yOf = (value: number) =>
    PADDING.top + plotHeight * (1 - value / ceiling);

  return (
    <figure
      style={{
        ...panel,
        margin: 0,
        width: '100%',
        maxWidth: `${WIDTH + 40}px`,
        padding: '20px',
      }}
    >
      <figcaption
        style={{
          ...baseText,
          fontSize: '16px',
          fontWeight: 600,
          marginBottom: '12px',
        }}
      >
        {title}
      </figcaption>
      {hasData ? (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          role="img"
          aria-label={`${title}: ${data.map((p) => `${p.label} ${p.value}`).join(', ')}`}
          style={{ display: 'block', fontFamily }}
        >
          {ticks.map((value, index) => {
            const y = yOf(value);
            return (
              <g key={value}>
                <line
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke={palette.border}
                  strokeDasharray={index === 0 ? undefined : '3 4'}
                />
                <text
                  x={PADDING.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill={palette.textMuted}
                >
                  {compact.format(value)}
                </text>
              </g>
            );
          })}
          {data.map((point, index) => {
            const x = PADDING.left + slot * index + (slot - barWidth) / 2;
            const y = yOf(point.value);
            const height = Math.max(0, PADDING.top + plotHeight - y);
            return (
              <g key={point.label}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx={BAR_RADIUS}
                  fill={palette.accent}
                />
                <text
                  x={x + barWidth / 2}
                  y={HEIGHT - 10}
                  textAnchor="middle"
                  fontSize="12"
                  fill={palette.textMuted}
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div
          style={{
            ...baseText,
            height: HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: palette.textMuted,
            border: `1px dashed ${palette.border}`,
            borderRadius: '8px',
          }}
        >
          {emptyMessage}
        </div>
      )}
    </figure>
  );
};
