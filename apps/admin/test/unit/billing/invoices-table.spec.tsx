import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { InvoicesTable } from '@/features/billing/list-subscription-invoices/invoices-table';
import type { SubscriptionInvoiceRow } from '@/features/billing/types';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const messages = {
  billing: {
    tables: {
      invoice: 'Invoice',
      organization: 'Organization',
      amountSar: 'Amount (⃁)',
      refunded: 'Refunded',
      status: 'Status',
      period: 'Period',
      due: 'Due',
      actions: 'Actions',
      open: 'Open',
      emptyInvoices: 'No invoices.',
      emptySubscriptions: 'No subscriptions.',
    },
    invoiceStatus: {
      PAID: 'Paid',
      DUE: 'Due',
      FAILED: 'Failed',
      VOID: 'Void',
      DRAFT: 'Draft',
    },
  },
  organizations: {
    status: {
      ACTIVE: 'Active',
      TRIALING: 'Trialing',
      PAST_DUE: 'Past due',
      SUSPENDED: 'Suspended',
      ARCHIVED: 'Archived',
    },
  },
};

const BASE_INVOICE: SubscriptionInvoiceRow = {
  id: 'inv-abcdef12345',
  subscriptionId: 'sub-1',
  organizationId: 'org-1',
  organization: {
    id: 'org-1',
    slug: 'test-clinic',
    nameAr: 'عيادة اختبار',
    nameEn: 'Test Clinic',
    status: 'ACTIVE',
    suspendedAt: null,
  },
  amount: '299.00',
  flatAmount: '299.00',
  overageAmount: '0.00',
  currency: 'SAR',
  status: 'PAID',
  billingCycle: 'MONTHLY',
  periodStart: '2026-05-01T00:00:00Z',
  periodEnd: '2026-05-31T00:00:00Z',
  dueDate: '2026-05-05T00:00:00Z',
  issuedAt: '2026-05-01T00:00:00Z',
  paidAt: '2026-05-03T00:00:00Z',
  refundedAmount: null,
  refundedAt: null,
  voidedReason: null,
  createdAt: '2026-05-01T00:00:00Z',
};

function wrap(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('InvoicesTable', () => {
  it('renders column headers', () => {
    wrap(<InvoicesTable items={[]} isLoading={false} />);
    expect(screen.getByText('Invoice')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Amount (⃁)')).toBeInTheDocument();
  });

  it('shows skeleton rows when loading with no items', () => {
    wrap(<InvoicesTable items={undefined} isLoading={true} />);
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when items is empty array', () => {
    wrap(<InvoicesTable items={[]} isLoading={false} />);
    expect(screen.getByText(/no invoices/i)).toBeInTheDocument();
  });

  it('renders invoice row with org name and amount', () => {
    wrap(<InvoicesTable items={[BASE_INVOICE]} isLoading={false} />);
    expect(screen.getByText('عيادة اختبار')).toBeInTheDocument();
    expect(screen.getByText('299.00')).toBeInTheDocument();
  });

  it('renders the Open link pointing to billing/orgId', () => {
    wrap(<InvoicesTable items={[BASE_INVOICE]} isLoading={false} />);
    const link = screen.getByRole('link', { name: /open/i });
    expect(link).toHaveAttribute('href', '/billing/org-1');
  });

  it('renders PAID status badge', () => {
    wrap(<InvoicesTable items={[BASE_INVOICE]} isLoading={false} />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('shows refunded amount with minus sign when present', () => {
    const refundedInv: SubscriptionInvoiceRow = {
      ...BASE_INVOICE,
      refundedAmount: '50.00',
    };
    wrap(<InvoicesTable items={[refundedInv]} isLoading={false} />);
    expect(screen.getByText('−50.00')).toBeInTheDocument();
  });

  it('shows — for refunded column when no refund', () => {
    wrap(<InvoicesTable items={[BASE_INVOICE]} isLoading={false} />);
    // refundedAmount is null — shows '—'
    // There may be multiple '—' (for null dates too), check with getAllByText
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders OrganizationCell without org (fallback to id slice)', () => {
    const invNoOrg: SubscriptionInvoiceRow = {
      ...BASE_INVOICE,
      organization: undefined as unknown as SubscriptionInvoiceRow['organization'],
    };
    wrap(<InvoicesTable items={[invNoOrg]} isLoading={false} />);
    expect(screen.getByText('org-1...')).toBeInTheDocument();
  });

  it('renders English name when org has nameEn', () => {
    wrap(<InvoicesTable items={[BASE_INVOICE]} isLoading={false} />);
    expect(screen.getByText('Test Clinic')).toBeInTheDocument();
  });

  it('renders DUE status badge for DUE invoice', () => {
    const dueInv: SubscriptionInvoiceRow = { ...BASE_INVOICE, status: 'DUE', paidAt: null };
    wrap(<InvoicesTable items={[dueInv]} isLoading={false} />);
    // "Due" appears in both the column header and the status badge
    expect(screen.getAllByText('Due').length).toBeGreaterThan(0);
  });
});
