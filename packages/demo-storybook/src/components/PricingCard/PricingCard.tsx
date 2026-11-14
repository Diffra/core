import type React from 'react';
import { palette, panel, radius, tones } from '../../theme';

export interface PricingCardProps {
  name: string;
  /** Monthly price in whole dollars. */
  price: number;
  /** Struck-through list price, shown when a discount applies. */
  originalPrice?: number;
  description: string;
  features: string[];
  ctaLabel: string;
  ribbon?: string;
  highlighted?: boolean;
}

const CARD_WIDTH = '300px';

const Check: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke={tones.success.fg}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ flexShrink: 0, marginTop: '3px' }}
  >
    <path d="M3 8.5l3.2 3.2L13 5" />
  </svg>
);

export const PricingCard: React.FC<PricingCardProps> = ({
  name,
  price,
  originalPrice,
  description,
  features,
  ctaLabel,
  ribbon,
  highlighted = false,
}) => (
  <section
    aria-label={`${name} plan`}
    style={{
      ...panel,
      position: 'relative',
      width: '100%',
      maxWidth: CARD_WIDTH,
      padding: '28px 24px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      borderColor: highlighted ? palette.accent : palette.border,
      boxShadow: highlighted ? '0 8px 24px rgba(56, 139, 253, 0.2)' : 'none',
    }}
  >
    {ribbon && (
      <span
        style={{
          position: 'absolute',
          top: '-12px',
          left: '24px',
          padding: '3px 12px',
          fontSize: '12px',
          fontWeight: 700,
          color: '#ffffff',
          background: palette.accentStrong,
          borderRadius: radius.pill,
        }}
      >
        {ribbon}
      </span>
    )}
    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{name}</h3>
    <p
      style={{
        margin: 0,
        fontSize: '14px',
        lineHeight: 1.5,
        color: palette.textMuted,
      }}
    >
      {description}
    </p>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
      <span style={{ fontSize: '36px', fontWeight: 700 }}>${price}</span>
      <span style={{ fontSize: '14px', color: palette.textMuted }}>
        per seat / month
      </span>
      {originalPrice !== undefined && (
        <span
          style={{
            fontSize: '14px',
            color: palette.textMuted,
            textDecoration: 'line-through',
          }}
        >
          ${originalPrice}
        </span>
      )}
    </div>
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        flexGrow: 1,
      }}
    >
      {features.map((feature) => (
        <li
          key={feature}
          style={{
            display: 'flex',
            gap: '10px',
            fontSize: '14px',
            lineHeight: 1.5,
          }}
        >
          <Check />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
    <span
      style={{
        textAlign: 'center',
        padding: '10px 16px',
        fontSize: '15px',
        fontWeight: 600,
        borderRadius: radius.small,
        color: highlighted ? '#ffffff' : palette.text,
        background: highlighted ? palette.accentStrong : palette.raised,
        border: `1px solid ${highlighted ? palette.accentStrong : palette.border}`,
      }}
    >
      {ctaLabel}
    </span>
  </section>
);
