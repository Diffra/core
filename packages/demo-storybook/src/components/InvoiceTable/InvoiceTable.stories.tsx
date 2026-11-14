import type { Meta, StoryObj } from '@storybook/react';
import { InvoiceTable } from './InvoiceTable';
import { recentInvoices } from './invoices';

const meta: Meta<typeof InvoiceTable> = {
  title: 'Data/InvoiceTable',
  component: InvoiceTable,
  parameters: {
    snapshot: {
      viewports: [
        { name: 'tablet', width: 768, height: 900 },
        { name: 'desktop', width: 1280, height: 800 },
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof InvoiceTable>;

export const RecentInvoices: Story = {
  args: { invoices: recentInvoices },
};

/** Catches ellipsis truncation turning into a wider column or wrapped rows. */
export const LongCustomerName: Story = {
  args: {
    invoices: [
      {
        number: 'INV-2051',
        customer:
          'Consolidated Regional Logistics and Freight Forwarding Holdings GmbH',
        amountCents: 2199900,
        status: 'pending',
        due: '03 Dec 2026',
      },
      ...recentInvoices.slice(0, 3),
    ],
  },
};

/** Catches decimals drifting out of alignment as amounts change length. */
export const MixedAmountMagnitudes: Story = {
  args: {
    invoices: [
      {
        number: 'INV-2060',
        customer: 'Wingtip Toys',
        amountCents: 5,
        status: 'draft',
        due: '05 Dec 2026',
      },
      {
        number: 'INV-2061',
        customer: 'Litware Inc',
        amountCents: 100000,
        status: 'paid',
        due: '05 Dec 2026',
      },
      {
        number: 'INV-2062',
        customer: 'Proseware',
        amountCents: 123456789,
        status: 'overdue',
        due: '05 Dec 2026',
      },
    ],
  },
};

export const NoMatchingInvoices: Story = {
  args: { invoices: [] },
};

/** Placeholder rows must keep the table height stable until data arrives. */
export const LoadingFirstPage: Story = {
  args: { invoices: [], loading: true },
};
