import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { BillingHealthCard } from '@/features/billing/billing-health-card/billing-health-card';
import type { DunningLogRow, SubscriptionRow } from '@/features/billing/types';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type SubWithPlan = SubscriptionRow & {
  plan: { slug: string; nameEn: string; priceMonthly: string | number };
};

const BASE_SUB: SubWithPlan = {
  id: 'sub-1',
  organizationId: 'org-1',
  organization: {
    id: 'org-1',
    slug: 'clinic',
    nameAr: 'عيادة',
    nameEn: null,
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

const DUNNING_LOG: DunningLogRow = {
  id: 'log-1',
  subscriptionId: 'sub-1',
  attemptNumber: 1,
  status: 'failed',
  scheduledFor: '2026-05-06T00:00:00Z',
  executedAt: '2026-05-06T00:00:00Z',
  failureReason: 'card_declined',
};

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return { ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>), queryClient: qc };
}

describe('BillingHealthCard', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  // ─── Status badge ───────────────────────────
  it('renders the ACTIVE status badge', () => {
    wrap(<BillingHealthCard orgId="org-1" subscription={BASE_SUB} dunningLogs={[]} />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('renders the PAST DUE status badge for PAST_DUE subscription', () => {
    const sub: SubWithPlan = { ...BASE_SUB, status: 'PAST_DUE', pastDueSince: '2026-05-05T00:00:00Z' };
    wrap(<BillingHealthCard orgId="org-1" subscription={sub} dunningLogs={[]} />);
    expect(screen.getByText('PAST DUE')).toBeInTheDocument();
  });

  it('renders the SUSPENDED status badge for SUSPENDED subscription', () => {
    const sub: SubWithPlan = { ...BASE_SUB, status: 'SUSPENDED' };
    wrap(<BillingHealthCard orgId="org-1" subscription={sub} dunningLogs={[]} />);
    expect(screen.getByText('SUSPENDED')).toBeInTheDocument();
  });

  // ─── Force charge button ────────────────────
  it('shows "Force charge now" button when status is PAST_DUE', () => {
    const sub: SubWithPlan = { ...BASE_SUB, status: 'PAST_DUE' };
    wrap(<BillingHealthCard orgId="org-1" subscription={sub} dunningLogs={[DUNNING_LOG]} />);
    expect(screen.getByRole('button', { name: /force charge now/i })).toBeInTheDocument();
  });

  it('does NOT show "Force charge now" when status is ACTIVE', () => {
    wrap(<BillingHealthCard orgId="org-1" subscription={BASE_SUB} dunningLogs={[]} />);
    expect(screen.queryByRole('button', { name: /force charge now/i })).not.toBeInTheDocument();
  });

  it('clicking "Force charge now" calls the forceCharge API', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ success: true, message: 'ok', result: { ok: true, status: 'succeeded', attemptNumber: 1 } });
    const sub: SubWithPlan = { ...BASE_SUB, status: 'PAST_DUE' };
    wrap(<BillingHealthCard orgId="org-fc" subscription={sub} dunningLogs={[DUNNING_LOG]} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /force charge now/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith(
        '/billing/subscriptions/org-fc/force-charge',
        { method: 'POST' },
      );
    });
  });

  // ─── Cancel scheduled cancellation button ───
  it('shows "Cancel scheduled cancellation" button when cancelAtPeriodEnd is true', () => {
    const sub: SubWithPlan = { ...BASE_SUB, cancelAtPeriodEnd: true };
    wrap(<BillingHealthCard orgId="org-1" subscription={sub} dunningLogs={[]} />);
    expect(screen.getByRole('button', { name: /cancel scheduled cancellation/i })).toBeInTheDocument();
  });

  it('does NOT show "Cancel scheduled cancellation" when cancelAtPeriodEnd is false', () => {
    wrap(<BillingHealthCard orgId="org-1" subscription={BASE_SUB} dunningLogs={[]} />);
    expect(screen.queryByRole('button', { name: /cancel scheduled cancellation/i })).not.toBeInTheDocument();
  });

  it('clicking "Cancel scheduled cancellation" calls the cancelScheduled API', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ id: 'sub-1' });
    const sub: SubWithPlan = { ...BASE_SUB, cancelAtPeriodEnd: true };
    wrap(<BillingHealthCard orgId="org-cs" subscription={sub} dunningLogs={[]} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel scheduled cancellation/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith(
        '/billing/subscriptions/org-cs/cancel-scheduled',
        { method: 'POST' },
      );
    });
  });

  // ─── ACTIVE, cancelAtPeriodEnd=false — neither button ───
  it('shows neither action button when ACTIVE and cancelAtPeriodEnd=false', () => {
    wrap(<BillingHealthCard orgId="org-1" subscription={BASE_SUB} dunningLogs={[]} />);
    expect(screen.queryByRole('button', { name: /force charge now/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel scheduled cancellation/i })).not.toBeInTheDocument();
  });

  // ─── "Cancels at period end" badge ──────────
  it('shows "Cancels at period end" badge when cancelAtPeriodEnd=true', () => {
    const sub: SubWithPlan = { ...BASE_SUB, cancelAtPeriodEnd: true };
    wrap(<BillingHealthCard orgId="org-1" subscription={sub} dunningLogs={[]} />);
    expect(screen.getByText(/cancels at period end/i)).toBeInTheDocument();
  });

  // ─── Dunning section ────────────────────────
  it('shows dunning section when status is PAST_DUE', () => {
    const sub: SubWithPlan = { ...BASE_SUB, status: 'PAST_DUE' };
    wrap(<BillingHealthCard orgId="org-1" subscription={sub} dunningLogs={[DUNNING_LOG]} />);
    expect(screen.getByText(/attempts/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // dunningLogs.length
  });

  it('shows dunning section when status is SUSPENDED', () => {
    const sub: SubWithPlan = { ...BASE_SUB, status: 'SUSPENDED' };
    wrap(<BillingHealthCard orgId="org-1" subscription={sub} dunningLogs={[]} />);
    expect(screen.getByText(/attempts/i)).toBeInTheDocument();
  });

  it('does NOT show dunning section when ACTIVE with no dunning logs', () => {
    wrap(<BillingHealthCard orgId="org-1" subscription={BASE_SUB} dunningLogs={[]} />);
    expect(screen.queryByText(/attempts/i)).not.toBeInTheDocument();
  });

  it('shows attempts count equal to dunningLogs.length', () => {
    const sub: SubWithPlan = { ...BASE_SUB, status: 'PAST_DUE' };
    const logs: DunningLogRow[] = [
      { ...DUNNING_LOG, id: 'log-1' },
      { ...DUNNING_LOG, id: 'log-2', attemptNumber: 2 },
      { ...DUNNING_LOG, id: 'log-3', attemptNumber: 3 },
    ];
    wrap(<BillingHealthCard orgId="org-1" subscription={sub} dunningLogs={logs} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('uses dunningLogs[0] as the latest log', () => {
    const sub: SubWithPlan = { ...BASE_SUB, status: 'PAST_DUE' };
    const latestLog: DunningLogRow = {
      ...DUNNING_LOG,
      id: 'log-latest',
      executedAt: '2026-05-08T00:00:00Z',
      status: 'FAILED',
    };
    const olderLog: DunningLogRow = {
      ...DUNNING_LOG,
      id: 'log-old',
      executedAt: '2026-05-06T00:00:00Z',
    };
    wrap(<BillingHealthCard orgId="org-1" subscription={sub} dunningLogs={[latestLog, olderLog]} />);
    // The status badge of the latest log should be rendered
    expect(screen.getByText('FAILED')).toBeInTheDocument();
  });
});
