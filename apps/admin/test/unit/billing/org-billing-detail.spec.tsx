import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { OrgBillingDetail } from '@/features/billing/get-org-billing/org-billing-detail';
import type { OrgBillingDetail as OrgBillingDetailType, SubscriptionInvoiceRow } from '@/features/billing/types';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock the child dialogs to avoid Radix/jsdom pointer issues
vi.mock('@/features/billing/change-plan-for-org/change-plan-dialog', () => ({
  ChangePlanDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="change-plan-dialog">ChangePlanDialog</div> : null,
}));
vi.mock('@/features/billing/grant-credit/grant-credit-dialog', () => ({
  GrantCreditDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="grant-credit-dialog">GrantCreditDialog</div> : null,
}));
vi.mock('@/features/billing/refund-invoice/refund-invoice-dialog', () => ({
  RefundInvoiceDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="refund-invoice-dialog">RefundInvoiceDialog</div> : null,
}));
vi.mock('@/features/billing/waive-invoice/waive-invoice-dialog', () => ({
  WaiveInvoiceDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="waive-invoice-dialog">WaiveInvoiceDialog</div> : null,
}));
vi.mock('@/features/billing/billing-health-card/billing-health-card', () => ({
  BillingHealthCard: () => <div data-testid="billing-health-card">BillingHealthCard</div>,
}));

const PAID_INVOICE: SubscriptionInvoiceRow = {
  id: 'inv-paid-001',
  subscriptionId: 'sub-1',
  organizationId: 'org-1',
  organization: { id: 'org-1', slug: 'tc', nameAr: 'عيادة', nameEn: null, status: 'ACTIVE', suspendedAt: null },
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

const DUE_INVOICE: SubscriptionInvoiceRow = {
  ...PAID_INVOICE,
  id: 'inv-due-001',
  status: 'DUE',
  paidAt: null,
};

const MOCK_BILLING_DATA: OrgBillingDetailType = {
  org: {
    id: 'org-1',
    slug: 'test-clinic',
    nameAr: 'عيادة اختبار',
    nameEn: 'Test Clinic',
    status: 'ACTIVE',
  },
  subscription: {
    id: 'sub-1',
    organizationId: 'org-1',
    organization: { id: 'org-1', slug: 'tc', nameAr: 'عيادة', nameEn: null, status: 'ACTIVE', suspendedAt: null },
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
  },
  invoices: [PAID_INVOICE, DUE_INVOICE],
  usage: [
    { metric: 'EMPLOYEES', count: 5, periodStart: '2026-05-01T00:00:00Z', periodEnd: '2026-05-31T00:00:00Z' },
  ],
  credits: [
    {
      id: 'credit-1',
      amount: '100.00',
      currency: 'SAR',
      reason: 'Goodwill credit',
      grantedByUserId: 'admin-1',
      grantedAt: '2026-05-01T00:00:00Z',
      consumedInvoiceId: null,
      consumedAt: null,
    },
  ],
  dunningLogs: [],
};

function wrap(orgId = 'org-1') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    ...render(<QueryClientProvider client={qc}><OrgBillingDetail orgId={orgId} /></QueryClientProvider>),
    queryClient: qc,
  };
}

describe('OrgBillingDetail', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('shows skeleton while loading', () => {
    vi.mocked(adminRequest).mockImplementation(() => new Promise(() => {}));
    wrap();
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state when API fails', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('fetch_error'));
    wrap();
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('renders org name and slug after data loads', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => {
      expect(screen.getByText('عيادة اختبار')).toBeInTheDocument();
    });
    expect(screen.getByText(/test clinic/i)).toBeInTheDocument();
  });

  it('renders BillingHealthCard when subscription exists', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => {
      expect(screen.getByTestId('billing-health-card')).toBeInTheDocument();
    });
  });

  it('renders Subscription tab content with plan info', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => {
      expect(screen.getByText('Basic')).toBeInTheDocument();
    });
  });

  it('shows "Change plan…" button in subscription tab', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /change plan/i })).toBeInTheDocument();
    });
  });

  it('opens ChangePlanDialog when "Change plan…" is clicked', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('button', { name: /change plan/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /change plan/i }));
    expect(screen.getByTestId('change-plan-dialog')).toBeInTheDocument();
  });

  it('shows invoices in the Invoices tab', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /invoices/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /invoices/i }));
    // PAID invoice row renders
    expect(screen.getByText(/inv-paid/i)).toBeInTheDocument();
  });

  it('shows "Waive" button for DUE invoices', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /invoices/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /invoices/i }));
    expect(screen.getByRole('button', { name: /waive/i })).toBeInTheDocument();
  });

  it('shows "Refund" button for PAID non-fully-refunded invoices', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /invoices/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /invoices/i }));
    expect(screen.getByRole('button', { name: /refund/i })).toBeInTheDocument();
  });

  it('opens WaiveInvoiceDialog when Waive button clicked', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /invoices/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /invoices/i }));
    await user.click(screen.getByRole('button', { name: /waive/i }));
    expect(screen.getByTestId('waive-invoice-dialog')).toBeInTheDocument();
  });

  it('opens RefundInvoiceDialog when Refund button clicked', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /invoices/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /invoices/i }));
    await user.click(screen.getByRole('button', { name: /refund/i }));
    expect(screen.getByTestId('refund-invoice-dialog')).toBeInTheDocument();
  });

  it('shows usage records in Usage tab', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /usage/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /usage/i }));
    expect(screen.getByText(/employees/i)).toBeInTheDocument();
  });

  it('shows credits in Credits tab', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /credits/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /credits/i }));
    expect(screen.getByText('Goodwill credit')).toBeInTheDocument();
  });

  it('shows "Grant credit…" button in Credits tab', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /credits/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /credits/i }));
    expect(screen.getByRole('button', { name: /grant credit/i })).toBeInTheDocument();
  });

  it('opens GrantCreditDialog when "Grant credit…" clicked', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /credits/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /credits/i }));
    await user.click(screen.getByRole('button', { name: /grant credit/i }));
    expect(screen.getByTestId('grant-credit-dialog')).toBeInTheDocument();
  });

  it('shows empty dunning message in Dunning tab when no logs', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /dunning/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /dunning/i }));
    expect(screen.getByText(/no dunning attempts/i)).toBeInTheDocument();
  });

  it('shows "no subscription" message when subscription is null', async () => {
    const noSubData: OrgBillingDetailType = { ...MOCK_BILLING_DATA, subscription: null, invoices: [] };
    vi.mocked(adminRequest).mockResolvedValue(noSubData);
    wrap();
    await waitFor(() => {
      expect(screen.getByText(/no subscription on file/i)).toBeInTheDocument();
    });
  });

  it('shows empty credits message in Credits tab when credits array is empty', async () => {
    const noCreditData: OrgBillingDetailType = { ...MOCK_BILLING_DATA, credits: [], invoices: [] };
    vi.mocked(adminRequest).mockResolvedValue(noCreditData);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /credits/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /credits/i }));
    expect(screen.getByText(/no credits granted/i)).toBeInTheDocument();
  });

  it('shows empty usage message when usage is empty', async () => {
    const noUsageData: OrgBillingDetailType = { ...MOCK_BILLING_DATA, usage: [], invoices: [] };
    vi.mocked(adminRequest).mockResolvedValue(noUsageData);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /usage/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /usage/i }));
    expect(screen.getByText(/no usage records/i)).toBeInTheDocument();
  });

  it('does not show Refund button for fully-refunded PAID invoice', async () => {
    const fullyRefundedData: OrgBillingDetailType = {
      ...MOCK_BILLING_DATA,
      invoices: [
        { ...PAID_INVOICE, refundedAmount: '299.00' }, // fully refunded
      ],
    };
    vi.mocked(adminRequest).mockResolvedValue(fullyRefundedData);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /invoices/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /invoices/i }));
    expect(screen.queryByRole('button', { name: /refund/i })).not.toBeInTheDocument();
  });

  it('renders dunning log rows in Dunning tab when logs exist', async () => {
    const dunningData: OrgBillingDetailType = {
      ...MOCK_BILLING_DATA,
      dunningLogs: [
        {
          id: 'log-1',
          subscriptionId: 'sub-1',
          attemptNumber: 2,
          status: 'failed',
          scheduledFor: '2026-05-05T00:00:00Z',
          executedAt: '2026-05-05T00:00:00Z',
          failureReason: 'card_declined',
        },
      ],
    };
    vi.mocked(adminRequest).mockResolvedValue(dunningData);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /dunning/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /dunning/i }));
    expect(screen.getByText('card_declined')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('shows "unused" for credits without consumedAt', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_DATA);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /credits/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /credits/i }));
    expect(screen.getByText('unused')).toBeInTheDocument();
  });

  it('shows consumed date for credits with consumedAt', async () => {
    const consumedData: OrgBillingDetailType = {
      ...MOCK_BILLING_DATA,
      credits: [
        {
          id: 'credit-consumed',
          amount: '50.00',
          currency: 'SAR',
          reason: 'Promotional credit',
          grantedByUserId: 'admin-1',
          grantedAt: '2026-04-01T00:00:00Z',
          consumedInvoiceId: 'inv-1',
          consumedAt: '2026-05-01T00:00:00Z',
        },
      ],
      invoices: [],
    };
    vi.mocked(adminRequest).mockResolvedValue(consumedData);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /credits/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /credits/i }));
    // consumedAt renders as a date — should NOT show 'unused'
    expect(screen.queryByText('unused')).not.toBeInTheDocument();
    // 'Promotional credit' reason shows
    expect(screen.getByText('Promotional credit')).toBeInTheDocument();
  });

  it('shows Waive button for FAILED invoice', async () => {
    const failedData: OrgBillingDetailType = {
      ...MOCK_BILLING_DATA,
      invoices: [{ ...DUE_INVOICE, id: 'inv-fail-001', status: 'FAILED' }],
    };
    vi.mocked(adminRequest).mockResolvedValue(failedData);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /invoices/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /invoices/i }));
    expect(screen.getByRole('button', { name: /waive/i })).toBeInTheDocument();
  });

  it('shows "No invoices." when invoices array is empty', async () => {
    const noInvData: OrgBillingDetailType = { ...MOCK_BILLING_DATA, invoices: [] };
    vi.mocked(adminRequest).mockResolvedValue(noInvData);
    wrap();
    await waitFor(() => screen.getByRole('tab', { name: /invoices/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /invoices/i }));
    expect(screen.getByText(/no invoices/i)).toBeInTheDocument();
  });

  it('shows subscription pastDueSince when present', async () => {
    const pastDueData: OrgBillingDetailType = {
      ...MOCK_BILLING_DATA,
      subscription: {
        ...MOCK_BILLING_DATA.subscription!,
        status: 'PAST_DUE',
        pastDueSince: '2026-05-03T00:00:00Z',
        lastFailureReason: 'insufficient_funds',
      },
    };
    vi.mocked(adminRequest).mockResolvedValue(pastDueData);
    wrap();
    await waitFor(() => {
      expect(screen.getByText(/past due since/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/last failure/i)).toBeInTheDocument();
  });
});
