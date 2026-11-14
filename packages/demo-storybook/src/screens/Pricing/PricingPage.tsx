import type React from 'react';
import { AppFrame, Icon, Logo } from '../../ui';

/** Yearly billing is 20 percent cheaper than paying month to month. */
const YEARLY_FACTOR = 0.8;
const MONTHS_PER_YEAR = 12;

interface Plan {
  name: string;
  tagline: string;
  monthly: number;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Starter',
    tagline: 'For side projects and small teams.',
    monthly: 15,
    features: ['5,000 snapshots a month', '3 projects', 'Community support'],
  },
  {
    name: 'Growth',
    tagline: 'For product teams shipping every week.',
    monthly: 49,
    popular: true,
    features: [
      '50,000 snapshots a month',
      'Unlimited projects',
      'Pull request status checks',
      'Priority support',
    ],
  },
  {
    name: 'Scale',
    tagline: 'For organisations with compliance needs.',
    monthly: 199,
    features: [
      'Unlimited snapshots',
      'Single sign-on and audit log',
      'Dedicated success manager',
      '99.99% uptime SLA',
    ],
  },
];

const formatPrice = (amount: number) => `$${Math.round(amount)}`;

export const PricingPage: React.FC = () => (
  <AppFrame>
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '22px 72px',
      }}
    >
      <Logo name="Lumen" />
      <span style={{ fontSize: 16, fontWeight: 700 }}>Sign in</span>
    </header>

    <section style={{ textAlign: 'center', padding: '24px 72px 0' }}>
      <h1 style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.03em' }}>
        Simple pricing that scales with you
      </h1>
      <p style={{ marginTop: 14, fontSize: 20, color: 'var(--ink-500)' }}>
        Start free for 14 days. No credit card required.
      </p>
      <div
        style={{
          display: 'inline-flex',
          gap: 6,
          marginTop: 28,
          padding: 6,
          borderRadius: 999,
          background: '#ffffff',
          border: '1px solid var(--line)',
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        <span style={{ padding: '10px 22px', color: 'var(--ink-500)' }}>
          Monthly
        </span>
        <span
          style={{
            padding: '10px 22px',
            borderRadius: 999,
            color: '#ffffff',
            background: 'var(--brand-500)',
          }}
        >
          Yearly · save 20%
        </span>
      </div>
    </section>

    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 28,
        maxWidth: 1180,
        margin: '0 auto',
        padding: '40px 72px 56px',
      }}
    >
      {PLANS.map((plan) => {
        const price = formatPrice(plan.monthly * YEARLY_FACTOR);
        const saving = formatPrice(
          plan.monthly * MONTHS_PER_YEAR * (1 - YEARLY_FACTOR),
        );
        const dark = plan.popular === true;
        return (
          <article
            key={plan.name}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              padding: 34,
              borderRadius: 28,
              color: dark ? '#ffffff' : 'var(--ink-900)',
              background: dark
                ? 'linear-gradient(160deg, #4f46e5, #312e81)'
                : '#ffffff',
              border: dark ? 'none' : '1px solid var(--line)',
              boxShadow: dark ? '0 28px 56px rgba(49, 46, 129, 0.35)' : 'none',
            }}
          >
            {dark && (
              <span
                style={{
                  position: 'absolute',
                  top: 18,
                  right: 18,
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#312e81',
                  background: '#fde68a',
                }}
              >
                Most popular
              </span>
            )}
            <h2 style={{ fontSize: 24, fontWeight: 800 }}>{plan.name}</h2>
            <p style={{ fontSize: 16, opacity: 0.75 }}>{plan.tagline}</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                }}
              >
                {price}
              </span>
              <span style={{ fontSize: 17, opacity: 0.75 }}>per month</span>
            </div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: dark ? '#fde68a' : 'var(--success)',
              }}
            >
              Billed yearly · you save {saving}
            </p>
            <span
              style={{
                textAlign: 'center',
                padding: '15px 0',
                borderRadius: 14,
                fontSize: 17,
                fontWeight: 800,
                color: dark ? '#312e81' : '#ffffff',
                background: dark ? '#ffffff' : 'var(--ink-900)',
              }}
            >
              Choose {plan.name}
            </span>
            <ul
              style={{
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                paddingTop: 8,
              }}
            >
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  style={{ display: 'flex', gap: 12, fontSize: 16 }}
                >
                  <Icon
                    name="check"
                    size={20}
                    strokeWidth={3}
                    color={dark ? '#a5b4fc' : 'var(--success)'}
                  />
                  {feature}
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </section>
  </AppFrame>
);
