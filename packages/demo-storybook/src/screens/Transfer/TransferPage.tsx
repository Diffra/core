import type React from 'react';
import { AppFrame, Icon, Logo, Person } from '../../ui';

const SPINNER_CSS = `
@keyframes dx-spin { to { transform: rotate(360deg); } }
.dx-spinner { animation: dx-spin 0.9s linear infinite; }
`;

export interface TransferPageProps {
  /** Shows the blocking overlay while the transfer is being verified. */
  processing?: boolean;
}

const Line: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong = false,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: strong ? 20 : 16,
      fontWeight: strong ? 800 : 500,
      color: strong ? 'var(--ink-900)' : 'var(--ink-700)',
    }}
  >
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const INITIALLY_PROCESSING = false;

export const TransferPage: React.FC<TransferPageProps> = ({
  processing = INITIALLY_PROCESSING,
}) => (
  <AppFrame
    style={{ background: 'linear-gradient(180deg, #ecfeff, #f6f7fb 40%)' }}
  >
    <style>{SPINNER_CSS}</style>
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '22px 64px',
      }}
    >
      <Logo name="Harbor" accent="#0891b2" />
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        <Icon name="bell" size={22} />
        <Person name="Maya Lindqvist" color="#0891b2" size={38} />
      </span>
    </header>

    <main
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '12px 64px 48px',
      }}
    >
      <div
        style={{
          width: 640,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          padding: 44,
          borderRadius: 32,
          background: '#ffffff',
          border: '1px solid var(--line)',
          boxShadow: '0 24px 60px rgba(8, 145, 178, 0.12)',
        }}
      >
        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Send money
        </h1>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: 18,
            borderRadius: 18,
            background: 'var(--page)',
          }}
        >
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: '#0891b2',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="lock" size={22} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: 'var(--ink-500)' }}>From</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              Everyday account ·· 4821
            </div>
          </div>
          <strong style={{ fontSize: 18 }}>$12,480.22</strong>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: 18,
            borderRadius: 18,
            background: 'var(--page)',
          }}
        >
          <Person name="Alex Chen" color="#f97316" size={46} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: 'var(--ink-500)' }}>To</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Alex Chen</div>
          </div>
          <span style={{ fontSize: 15, color: 'var(--ink-500)' }}>·· 7730</span>
        </div>

        <div style={{ textAlign: 'center', padding: '18px 0 8px' }}>
          <div
            style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-500)' }}
          >
            Amount
          </div>
          <div
            style={{ fontSize: 76, fontWeight: 800, letterSpacing: '-0.04em' }}
          >
            $1,250.00
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingTop: 18,
            borderTop: '1px solid var(--line)',
          }}
        >
          <Line label="Transfer fee" value="$0.00" />
          <Line label="Arrives" value="Today, within minutes" />
          <Line label="Total debited" value="$1,250.00" strong />
        </div>

        <span
          style={{
            textAlign: 'center',
            padding: '19px 0',
            borderRadius: 16,
            fontSize: 19,
            fontWeight: 800,
            color: '#ffffff',
            background: '#0891b2',
          }}
        >
          Confirm transfer
        </span>
      </div>
    </main>

    {processing && (
      <div
        role="status"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 22,
          background: 'rgba(255, 255, 255, 0.86)',
        }}
      >
        <svg
          className="dx-spinner"
          width="84"
          height="84"
          viewBox="0 0 84 84"
          aria-hidden="true"
        >
          <circle
            cx="42"
            cy="42"
            r="34"
            fill="none"
            stroke="#cffafe"
            strokeWidth="9"
          />
          <path
            d="M42 8a34 34 0 0 1 34 34"
            fill="none"
            stroke="#0891b2"
            strokeWidth="9"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ fontSize: 26, fontWeight: 800 }}>
          Verifying your transfer…
        </div>
        <div style={{ fontSize: 16, color: 'var(--ink-500)' }}>
          This usually takes a few seconds.
        </div>
      </div>
    )}
  </AppFrame>
);
