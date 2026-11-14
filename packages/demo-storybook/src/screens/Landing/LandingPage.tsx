import type React from 'react';
import { AppFrame, Icon, Logo, Person } from '../../ui';
import { dashboardPreview } from '../../ui/art';

const HERO_IMAGE = dashboardPreview();

const NAV = ['Product', 'Pricing', 'Customers', 'Docs'];
const CUSTOMERS = ['Northfield', 'Quanta', 'Helix&Co', 'Bluepeak', 'Marlow'];

export const LandingPage: React.FC = () => (
  <AppFrame style={{ background: '#ffffff' }}>
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 40,
        padding: '22px 72px',
      }}
    >
      <Logo name="Lumen" />
      <nav style={{ display: 'flex', gap: 32, flex: 1, marginLeft: 24 }}>
        {NAV.map((item) => (
          <span
            key={item}
            style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-700)' }}
          >
            {item}
          </span>
        ))}
      </nav>
      <span style={{ fontSize: 16, fontWeight: 600 }}>Sign in</span>
      <span
        style={{
          padding: '12px 22px',
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 700,
          color: '#ffffff',
          background: 'var(--ink-900)',
        }}
      >
        Start free trial
      </span>
    </header>

    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '1.05fr 1fr',
        alignItems: 'center',
        gap: 24,
        padding: '40px 72px 0',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <span
          style={{
            alignSelf: 'flex-start',
            padding: '8px 16px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--brand-500)',
            background: 'var(--brand-50)',
          }}
        >
          New · Release 4.2 is live
        </span>
        <h1
          style={{
            fontSize: 68,
            lineHeight: 1.04,
            fontWeight: 800,
            letterSpacing: '-0.035em',
          }}
        >
          Catch every visual bug before your customers do.
        </h1>
        <p
          style={{
            fontSize: 21,
            lineHeight: 1.5,
            color: 'var(--ink-500)',
            maxWidth: 520,
          }}
        >
          Lumen compares every pull request against your approved baseline and
          shows exactly what changed, in seconds.
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '18px 30px',
              borderRadius: 14,
              fontSize: 18,
              fontWeight: 700,
              color: '#ffffff',
              background: 'var(--brand-500)',
              boxShadow: '0 14px 30px rgba(79, 70, 229, 0.35)',
            }}
          >
            Start free trial <Icon name="arrow" size={20} />
          </span>
          <span
            style={{
              padding: '18px 30px',
              borderRadius: 14,
              fontSize: 18,
              fontWeight: 700,
              border: '2px solid var(--line)',
            }}
          >
            Book a demo
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex' }}>
            {[
              ['Maya Lindqvist', '#6366f1'],
              ['Daniel Okafor', '#0ea5e9'],
              ['Priya Raman', '#ec4899'],
            ].map(([name, color], index) => (
              <span
                key={name}
                style={{
                  marginLeft: index === 0 ? 0 : -10,
                  border: '3px solid #ffffff',
                  borderRadius: '50%',
                  display: 'inline-flex',
                }}
              >
                <Person
                  name={name ?? ''}
                  color={color ?? '#6366f1'}
                  size={40}
                />
              </span>
            ))}
          </div>
          <span style={{ fontSize: 15, color: 'var(--ink-500)' }}>
            <strong style={{ color: 'var(--ink-900)' }}>2,400 teams</strong>{' '}
            ship with confidence
          </span>
        </div>
      </div>

      <div
        style={{
          justifySelf: 'center',
          padding: 28,
          borderRadius: 36,
          background:
            'radial-gradient(circle at 30% 20%, #c7d2fe 0%, #e0e7ff 40%, #fce7f3 100%)',
        }}
      >
        <img
          src={HERO_IMAGE}
          alt="Lumen dashboard preview"
          width={520}
          height={400}
          style={{
            display: 'block',
            filter: 'drop-shadow(0 24px 40px rgba(49, 46, 129, 0.3))',
          }}
        />
      </div>
    </section>

    <footer
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '40px 72px 0',
        padding: '26px 0',
        borderTop: '1px solid var(--line)',
        color: 'var(--ink-300)',
        fontSize: 24,
        fontWeight: 800,
      }}
    >
      {CUSTOMERS.map((name) => (
        <span key={name}>{name}</span>
      ))}
    </footer>
  </AppFrame>
);
