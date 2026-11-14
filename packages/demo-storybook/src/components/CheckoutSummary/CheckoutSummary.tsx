import type React from 'react';
import { baseText, palette, panel, tones } from '../../theme';
import { Button } from '../Button/Button';
import { COPY, CURRENCY, DIRECTION, type Locale } from './copy';

export interface CheckoutLine {
  name: string;
  quantity: number;
  /** Unit price in minor units. */
  unitCents: number;
}

export interface CheckoutSummaryProps {
  locale?: Locale;
  lines: CheckoutLine[];
  /** Shipping in minor units. Zero shows as free. */
  shippingCents: number;
  taxCents: number;
  promo?: { code: string; discountCents: number };
}

export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({
  locale = 'en-US',
  lines,
  shippingCents,
  taxCents,
  promo,
}) => {
  const copy = COPY[locale];
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY[locale],
  });
  const format = (cents: number) => money.format(cents / 100);

  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitCents * line.quantity,
    0,
  );
  const discount = promo?.discountCents ?? 0;
  const total = subtotal - discount + shippingCents + taxCents;

  const row: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    fontSize: '14px',
  };

  return (
    <section
      dir={DIRECTION[locale]}
      lang={locale}
      aria-label={copy.heading}
      style={{
        ...panel,
        width: '100%',
        maxWidth: '400px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
        {copy.heading}
      </h3>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {lines.map((line) => (
          <li key={line.name} style={row}>
            <span
              style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
            >
              <span>{line.name}</span>
              <span style={{ fontSize: '13px', color: palette.textMuted }}>
                {copy.quantity(line.quantity)}
              </span>
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>
              {format(line.unitCents * line.quantity)}
            </span>
          </li>
        ))}
      </ul>
      <div
        style={{
          borderTop: `1px solid ${palette.border}`,
          paddingTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={row}>
          <span style={{ color: palette.textMuted }}>{copy.subtotal}</span>
          <span>{format(subtotal)}</span>
        </div>
        {promo && (
          <div style={{ ...row, color: tones.success.fg }}>
            <span>{copy.discount(promo.code)}</span>
            <span>−{format(promo.discountCents)}</span>
          </div>
        )}
        <div style={row}>
          <span style={{ color: palette.textMuted }}>{copy.shipping}</span>
          <span>
            {shippingCents === 0 ? copy.freeShipping : format(shippingCents)}
          </span>
        </div>
        <div style={row}>
          <span style={{ color: palette.textMuted }}>{copy.tax}</span>
          <span>{format(taxCents)}</span>
        </div>
        <div
          style={{
            ...row,
            fontSize: '18px',
            fontWeight: 700,
            paddingTop: '10px',
            borderTop: `1px solid ${palette.border}`,
          }}
        >
          <span>{copy.total}</span>
          <span>{format(total)}</span>
        </div>
      </div>
      <Button label={copy.pay} variant="primary" size="large" fullWidth />
      <p
        style={{
          ...baseText,
          margin: 0,
          fontSize: '13px',
          lineHeight: 1.5,
          color: palette.textMuted,
          textAlign: 'center',
        }}
      >
        {copy.secure}
      </p>
    </section>
  );
};
