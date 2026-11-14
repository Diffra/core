import React from 'react';
import { AppFrame, Icon, Logo, Person } from '../../ui';
import { AreaChart } from '../../ui/charts';

interface Report {
  series: number[];
  labels: string[];
  orders: Array<{
    id: string;
    customer: string;
    total: string;
    status: 'Paid' | 'Refunded' | 'Pending';
  }>;
}

const REPORT: Report = {
  series: [34, 41, 38, 52, 49, 61, 58, 72, 69, 84, 91, 103],
  labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
  orders: [
    {
      id: '#40918',
      customer: 'Northfield Ltd',
      total: '$4,820.00',
      status: 'Paid',
    },
    {
      id: '#40917',
      customer: 'Quanta Systems',
      total: '$1,299.50',
      status: 'Pending',
    },
    {
      id: '#40916',
      customer: 'Helix & Co',
      total: '$640.00',
      status: 'Refunded',
    },
    { id: '#40915', customer: 'Bluepeak', total: '$12,500.00', status: 'Paid' },
  ],
};

const STATUS_COLORS = {
  Paid: ['var(--success-bg)', 'var(--success)'],
  Pending: ['var(--warning-bg)', 'var(--warning)'],
  Refunded: ['var(--danger-bg)', 'var(--danger)'],
} as const;

const RevenueChart: React.FC<{ report: Report }> = ({ report }) => {
  const points = report.series;
  const total = points
    .map((value) => value * 1000)
    .reduce((sum, value) => sum + value, 0);
  return (
    <div
      style={{
        padding: 30,
        borderRadius: 22,
        background: '#ffffff',
        border: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Revenue this year</h2>
        <strong style={{ fontSize: 30, letterSpacing: '-0.02em' }}>
          ${total.toLocaleString('en-US')}
        </strong>
      </div>
      <AreaChart
        id="report"
        values={points}
        labels={report.labels}
        width={1000}
        height={240}
      />
    </div>
  );
};

const OrdersTable: React.FC<{ report: Report }> = ({ report }) => (
  <div
    style={{
      borderRadius: 22,
      background: '#ffffff',
      border: '1px solid var(--line)',
      overflow: 'hidden',
    }}
  >
    <h2 style={{ padding: '24px 30px 12px', fontSize: 22, fontWeight: 800 }}>
      Latest orders
    </h2>
    {report.orders.map((order) => (
      <div
        key={order.id}
        style={{
          display: 'grid',
          gridTemplateColumns: '120px 1fr 160px 120px',
          alignItems: 'center',
          padding: '16px 30px',
          borderTop: '1px solid var(--line)',
          fontSize: 16,
        }}
      >
        <strong>{order.id}</strong>
        <span>{order.customer}</span>
        <span style={{ fontWeight: 700 }}>{order.total}</span>
        <span
          style={{
            justifySelf: 'start',
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 800,
            background: STATUS_COLORS[order.status][0],
            color: STATUS_COLORS[order.status][1],
          }}
        >
          {order.status}
        </span>
      </div>
    ))}
  </div>
);

/** Keeps one broken widget from blanking the whole app, as many products do. */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          minHeight: 560,
          borderRadius: 28,
          background: '#ffffff',
          border: '1px solid var(--line)',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="alert" size={48} />
        </span>
        <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Something went wrong
        </h2>
        <p style={{ maxWidth: 520, fontSize: 18, color: 'var(--ink-500)' }}>
          We could not load this report. Our team has been notified.
        </p>
        <code
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            fontSize: 14,
            color: 'var(--danger)',
            background: 'var(--danger-bg)',
          }}
        >
          {this.state.error.message}
        </code>
        <span
          style={{
            marginTop: 8,
            padding: '14px 30px',
            borderRadius: 14,
            fontSize: 17,
            fontWeight: 800,
            color: '#ffffff',
            background: 'var(--brand-500)',
          }}
        >
          Reload page
        </span>
      </div>
    );
  }
}

export const AnalyticsPage: React.FC = () => (
  <AppFrame>
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 56px',
        background: '#ffffff',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <Logo name="Lumen" />
      <nav
        style={{
          display: 'flex',
          gap: 30,
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--ink-500)',
        }}
      >
        <span>Overview</span>
        <span style={{ color: 'var(--brand-500)' }}>Reports</span>
        <span>Customers</span>
        <span>Settings</span>
      </nav>
      <Person name="Maya Lindqvist" color="#6366f1" size={38} />
    </header>
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: '32px 56px 48px',
      }}
    >
      <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>
        Revenue report
      </h1>
      <ErrorBoundary>
        <RevenueChart report={REPORT} />
        <OrdersTable report={REPORT} />
      </ErrorBoundary>
    </main>
  </AppFrame>
);
