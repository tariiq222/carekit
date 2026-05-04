import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionsTable } from '@/features/billing/list-subscriptions/subscriptions-table';
import type { SubscriptionRow } from '@/features/billing/types';

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
      organization: 'Organization',
      plan: 'Plan',
      status: 'Status',
      cycle: 'Cycle',
      periodEnds: 'Period ends',
      lastPayment: 'Last payment',
      actions: 'Actions',
      open: 'Open',
      priceMonthly: '{amount} ⃁/mo',
      emptySubscriptions: 'No subscriptions.',
      emptyInvoices: 'No invoices.',
    },
    subscriptionStatus: {
      ACTIVE: 'Active',
      TRIALING: 'Trialing',
      PAST_DUE: 'Past due',
      SUSPENDED: 'Suspended',
      CANCELED: 'Canceled',
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

const BASE_SUB: SubscriptionRow = {
  id: 'sub-1',
  organizationId: 'org-1',
  organization: {
    id: 'org-1',
    slug: 'test-clinic',
    nameAr: 'عيادة اختبار',
    nameEn: 'Test Clinic',
    status: 'ACTIVE',
    suspendedAt: null,
  },
  planId: 'plan-1',
  status: 'ACTIVE',
  billingCycle: 'MONTHLY',
  currentPeriodStart: '2026-05-01T00:00:00Z',
  currentPeriodEnd: '2026-05-31T00:00:00Z',
  trialEndsAt: null,
  canceledAt: null,
  cancelAtPeriodEnd: false,
  pastDueSince: null,
  lastPaymentAt: '2026-05-01T00:00:00Z',
  lastFailureReason: null,
  createdAt: '2026-01-01T00:00:00Z',
  plan: { slug: 'basic', nameEn: 'Basic', priceMonthly: 299 },
};

function wrap(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('SubscriptionsTable', () => {
  it('renders column headers', () => {
    wrap(<SubscriptionsTable items={[]} isLoading={false} />);
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('shows skeleton rows when loading with no items', () => {
    wrap(<SubscriptionsTable items={undefined} isLoading={true} />);
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when items array is empty', () => {
    wrap(<SubscriptionsTable items={[]} isLoading={false} />);
    expect(screen.getByText(/no subscriptions/i)).toBeInTheDocument();
  });

  it('renders subscription row with org name and plan', () => {
    wrap(<SubscriptionsTable items={[BASE_SUB]} isLoading={false} />);
    expect(screen.getByText('عيادة اختبار')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
  });

  it('renders the Open link pointing to billing/orgId', () => {
    wrap(<SubscriptionsTable items={[BASE_SUB]} isLoading={false} />);
    const link = screen.getByRole('link', { name: /open/i });
    expect(link).toHaveAttribute('href', '/billing/org-1');
  });

  it('renders status badge for ACTIVE subscription', () => {
    wrap(<SubscriptionsTable items={[BASE_SUB]} isLoading={false} />);
    // "Active" appears in both the org status badge and subscription status badge
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });

  it('renders OrganizationCell without org (fallback to id slice)', () => {
    const subNoOrg: SubscriptionRow = {
      ...BASE_SUB,
      organization: undefined as unknown as SubscriptionRow['organization'],
    };
    wrap(<SubscriptionsTable items={[subNoOrg]} isLoading={false} />);
    // Falls back to organizationId.slice(0, 8)
    expect(screen.getByText('org-1...')).toBeInTheDocument();
  });

  it('renders English name when org has nameEn', () => {
    wrap(<SubscriptionsTable items={[BASE_SUB]} isLoading={false} />);
    expect(screen.getByText('Test Clinic')).toBeInTheDocument();
  });

  it('shows multiple subscription rows', () => {
    const sub2: SubscriptionRow = {
      ...BASE_SUB,
      id: 'sub-2',
      organizationId: 'org-2',
      organization: { ...BASE_SUB.organization, id: 'org-2', nameAr: 'عيادة ثانية', nameEn: null },
    };
    wrap(<SubscriptionsTable items={[BASE_SUB, sub2]} isLoading={false} />);
    expect(screen.getByText('عيادة اختبار')).toBeInTheDocument();
    expect(screen.getByText('عيادة ثانية')).toBeInTheDocument();
  });
});
