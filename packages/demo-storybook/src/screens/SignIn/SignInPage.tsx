import type React from 'react';
import { AppFrame, Icon, Logo } from '../../ui';

const FORM_TEXT = 'var(--ink-900)';

const Input: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <span style={{ fontSize: 15, fontWeight: 600, color: FORM_TEXT }}>
      {label}
    </span>
    <div
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        fontSize: 17,
        color: 'var(--ink-700)',
        background: '#0a0f1f',
        border: '1.5px solid var(--line)',
        borderRadius: 14,
      }}
    >
      {value}
    </div>
  </div>
);

export const SignInPage: React.FC = () => (
  <AppFrame
    theme="dark"
    style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr' }}
  >
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 64,
        color: '#ffffff',
        background:
          'radial-gradient(circle at 20% 10%, #6366f1 0%, #3730a3 45%, #1e1b4b 100%)',
      }}
    >
      <Logo name="Lumen" color="#ffffff" accent="#a5b4fc" />
      <div>
        <p
          style={{
            fontSize: 40,
            lineHeight: 1.2,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          “We stopped shipping visual bugs the week we turned Lumen on.”
        </p>
        <p style={{ marginTop: 24, fontSize: 18, opacity: 0.8 }}>
          Priya Raman · Head of Engineering, Bluepeak
        </p>
      </div>
      <span style={{ fontSize: 15, opacity: 0.6 }}>
        SOC 2 Type II · GDPR ready
      </span>
    </section>

    <section
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 56,
      }}
    >
      <div
        style={{
          width: 460,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          padding: 44,
          borderRadius: 28,
          background: 'var(--card)',
          border: '1px solid var(--line)',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: FORM_TEXT,
            }}
          >
            Welcome back
          </h1>
          <p style={{ marginTop: 10, fontSize: 16, color: 'var(--ink-500)' }}>
            Sign in to review your latest visual changes.
          </p>
        </div>
        <Input label="Work email" value="maya@bluepeak.io" />
        <Input label="Password" value="••••••••••••" />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 15,
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: FORM_TEXT,
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background: 'var(--brand-500)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <Icon name="check" size={14} strokeWidth={3} />
            </span>
            Keep me signed in
          </span>
          <span style={{ fontWeight: 700, color: '#a5b4fc' }}>
            Forgot password?
          </span>
        </div>
        <span
          style={{
            textAlign: 'center',
            padding: '17px 0',
            borderRadius: 14,
            fontSize: 18,
            fontWeight: 800,
            color: '#ffffff',
            background: 'var(--brand-500)',
          }}
        >
          Sign in
        </span>
        <span
          style={{
            textAlign: 'center',
            padding: '16px 0',
            borderRadius: 14,
            fontSize: 17,
            fontWeight: 700,
            color: FORM_TEXT,
            border: '1.5px solid var(--line)',
          }}
        >
          Continue with single sign-on
        </span>
      </div>
    </section>
  </AppFrame>
);
