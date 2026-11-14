import type React from 'react';
import { AppFrame, Icon, type IconName, Logo, Person } from '../../ui';
import { AreaChart } from '../../ui/charts';

const SIDEBAR_WIDTH = 260;

const NAV: Array<{ label: string; icon: IconName; active?: boolean }> = [
  { label: 'Overview', icon: 'home', active: true },
  { label: 'Customers', icon: 'users' },
  { label: 'Revenue', icon: 'chart' },
  { label: 'Reports', icon: 'file' },
  { label: 'Integrations', icon: 'plug' },
  { label: 'Settings', icon: 'cog' },
];

const KPIS = [
  { label: 'Monthly revenue', value: '$48,290', delta: '+12.4%', up: true },
  { label: 'Active customers', value: '12,480', delta: '+8.1%', up: true },
  { label: 'Conversion rate', value: '3.84%', delta: '+0.6%', up: true },
  { label: 'Churn', value: '1.2%', delta: '-0.3%', up: false },
];

const REVENUE = [21, 26, 24, 31, 35, 33, 41, 44, 40, 48, 52, 58];
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const REGIONS = [
  ['North America', 62],
  ['Europe', 48],
  ['Asia Pacific', 31],
  ['Latin America', 17],
] as const;

export const DashboardPage: React.FC = () => (
  <AppFrame>
    <aside
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: SIDEBAR_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        padding: '28px 20px',
        background: 'linear-gradient(180deg, #0f172a, #1e1b4b)',
        color: '#e2e8f0',
      }}
    >
      <Logo name="Lumen" color="#ffffff" accent="#818cf8" />
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {NAV.map((item) => (
          <span
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '13px 16px',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              color: item.active ? '#ffffff' : '#94a3b8',
              background: item.active
                ? 'rgba(129, 140, 248, 0.22)'
                : 'transparent',
            }}
          >
            <Icon name={item.icon} size={20} />
            {item.label}
          </span>
        ))}
      </nav>
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 14,
          background: 'rgba(255, 255, 255, 0.07)',
        }}
      >
        <Person name="Maya Lindqvist" color="#6366f1" size={40} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
            Maya Lindqvist
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Growth plan</div>
        </div>
      </div>
    </aside>

    <main
      style={{
        marginLeft: SIDEBAR_WIDTH,
        padding: '34px 44px',
        display: 'flex',
        flexDirection: 'column',
        gap: 26,
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1
            style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Good morning, Maya
          </h1>
          <p style={{ marginTop: 6, fontSize: 16, color: 'var(--ink-500)' }}>
            Here is how the business is doing this month.
          </p>
        </div>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 12,
            background: '#ffffff',
            border: '1px solid var(--line)',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          <Icon name="calendar" size={18} /> Last 12 months
        </span>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 20,
        }}
      >
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            style={{
              padding: 24,
              borderRadius: 20,
              background: '#ffffff',
              border: '1px solid var(--line)',
            }}
          >
            <div
              style={{ fontSize: 15, color: 'var(--ink-500)', fontWeight: 600 }}
            >
              {kpi.label}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              {kpi.value}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--success)',
              }}
            >
              {kpi.delta}{' '}
              <span style={{ color: 'var(--ink-500)', fontWeight: 500 }}>
                vs last month
              </span>
            </div>
          </div>
        ))}
      </section>

      <section
        style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 20 }}
      >
        <div
          style={{
            padding: 28,
            borderRadius: 20,
            background: '#ffffff',
            border: '1px solid var(--line)',
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
            Revenue
          </h2>
          <AreaChart
            id="overview"
            values={REVENUE}
            labels={MONTHS}
            width={640}
            height={250}
          />
        </div>
        <div
          style={{
            padding: 28,
            borderRadius: 20,
            background: '#ffffff',
            border: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Top regions</h2>
          {REGIONS.map(([region, share]) => (
            <div key={region}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 15,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                <span>{region}</span>
                <span style={{ color: 'var(--ink-500)' }}>{share}%</span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: 'var(--brand-50)',
                }}
              >
                <div
                  style={{
                    width: `${share}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: 'var(--brand-500)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  </AppFrame>
);
