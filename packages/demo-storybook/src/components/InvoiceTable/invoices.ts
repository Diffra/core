export type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'draft';

export interface Invoice {
  number: string;
  customer: string;
  /** Amount in minor units, so the table never formats floating point sums. */
  amountCents: number;
  status: InvoiceStatus;
  due: string;
}

export const recentInvoices: Invoice[] = [
  {
    number: 'INV-2041',
    customer: 'Northwind Traders',
    amountCents: 482000,
    status: 'paid',
    due: '12 Nov 2026',
  },
  {
    number: 'INV-2042',
    customer: 'Contoso Ltd',
    amountCents: 129950,
    status: 'pending',
    due: '28 Nov 2026',
  },
  {
    number: 'INV-2043',
    customer: 'Fabrikam Industries',
    amountCents: 7500,
    status: 'overdue',
    due: '02 Nov 2026',
  },
  {
    number: 'INV-2044',
    customer: 'Adventure Works',
    amountCents: 1250000,
    status: 'paid',
    due: '09 Nov 2026',
  },
  {
    number: 'INV-2045',
    customer: 'Tailspin Toys',
    amountCents: 63425,
    status: 'draft',
    due: '30 Nov 2026',
  },
];
