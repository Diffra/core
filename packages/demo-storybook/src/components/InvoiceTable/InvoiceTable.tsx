import type React from 'react';
import {
  baseText,
  palette,
  panel,
  radius,
  type Tone,
  tones,
} from '../../theme';
import type { Invoice, InvoiceStatus } from './invoices';

export interface InvoiceTableProps {
  invoices: Invoice[];
  /** Shows placeholder rows while the first page of invoices loads. */
  loading?: boolean;
}

const STATUS_TONE: Record<InvoiceStatus, Tone | 'neutral'> = {
  paid: 'success',
  pending: 'info',
  overdue: 'danger',
  draft: 'neutral',
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
  draft: 'Draft',
};

const PLACEHOLDER_ROWS = ['first', 'second', 'third', 'fourth', 'fifth'];
/** One width per column, so the placeholder rows follow the real layout. */
const PLACEHOLDER_WIDTHS = [72, 140, 80, 64, 90];
const CUSTOMER_MAX_WIDTH = '200px';

const TABLE_CSS = `
@keyframes dfx-shimmer {
  from { opacity: 0.35; }
  to { opacity: 0.8; }
}
.dfx-skeleton-cell {
  display: block;
  height: 14px;
  border-radius: 4px;
  background: ${palette.border};
  animation: dfx-shimmer 1.2s ease-in-out infinite alternate;
}
`;

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const cell: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '14px',
  borderBottom: `1px solid ${palette.border}`,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const headerCell: React.CSSProperties = {
  ...cell,
  fontSize: '13px',
  fontWeight: 600,
  color: palette.textMuted,
  background: palette.raised,
};

const StatusPill: React.FC<{ status: InvoiceStatus }> = ({ status }) => {
  const tone = STATUS_TONE[status];
  const colors =
    tone === 'neutral'
      ? { fg: palette.textMuted, bg: palette.raised, border: palette.border }
      : tones[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: radius.pill,
        fontSize: '12px',
        fontWeight: 600,
        color: colors.fg,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
};

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  loading = false,
}) => {
  const showEmpty = !loading && invoices.length === 0;
  return (
    <div
      style={{
        ...panel,
        width: '100%',
        maxWidth: '760px',
        overflowX: 'auto',
      }}
    >
      <style>{TABLE_CSS}</style>
      <table
        aria-busy={loading}
        style={{
          ...baseText,
          width: '100%',
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr>
            <th style={headerCell}>Invoice</th>
            <th style={headerCell}>Customer</th>
            <th style={{ ...headerCell, textAlign: 'right' }}>Amount</th>
            <th style={headerCell}>Status</th>
            <th style={headerCell}>Due</th>
          </tr>
        </thead>
        <tbody>
          {loading &&
            PLACEHOLDER_ROWS.map((rowId) => (
              <tr key={rowId}>
                {PLACEHOLDER_WIDTHS.map((width) => (
                  <td key={width} style={cell}>
                    <span className="dfx-skeleton-cell" style={{ width }} />
                  </td>
                ))}
              </tr>
            ))}
          {!loading &&
            invoices.map((invoice) => (
              <tr key={invoice.number}>
                <td style={{ ...cell, fontWeight: 600 }}>{invoice.number}</td>
                <td
                  style={{
                    ...cell,
                    maxWidth: CUSTOMER_MAX_WIDTH,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={invoice.customer}
                >
                  {invoice.customer}
                </td>
                <td
                  style={{
                    ...cell,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {money.format(invoice.amountCents / 100)}
                </td>
                <td style={cell}>
                  <StatusPill status={invoice.status} />
                </td>
                <td style={{ ...cell, color: palette.textMuted }}>
                  {invoice.due}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {showEmpty && (
        <p
          style={{
            ...baseText,
            margin: 0,
            padding: '40px 16px',
            textAlign: 'center',
            fontSize: '14px',
            color: palette.textMuted,
          }}
        >
          No invoices match your filters.
        </p>
      )}
    </div>
  );
};
