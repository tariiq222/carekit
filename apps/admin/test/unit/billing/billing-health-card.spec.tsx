import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BillingHealthCard } from '@/features/billing/billing-health-card/billing-health-card';
import type { DunningLogRow, SubscriptionRow } from '@/features/billing/types';

vi.mock('@/lib/api-client', () => ({
  adminRequest: vi.fn(),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const BASE_SUB: SubscriptionRow & {
  plan: { slug: string; nameEn: string; priceMonthly: string | number };
} = {
  id: 'sub-1',
  organizationId: 'org-1',
  organization: { id: 'org-1', slug: 'org', nameAr: 'Test', nameEn: null, status: 'ACTIVE', suspendedAt: null },
  planId: 'plan-1',
  status: 'PAST_DUE',
  billingCycle: 'MONTHLY',
  currentPeriodStart: '2026-04-01T00:00:00Z',
  currentPeriodEnd: '2026-04-30T00:00:00Z',
  trialEndsAt: null,
  canceledAt: null,
  cancelAtPeriodEnd: false,
  pastDueSince: '2026-04-05T00:00:00Z',
  lastPaymentAt: null,
  lastFailureReason: 'insufficient_funds',
  createdAt: '2026-01-01T00:00:00Z',
  plan: { slug: 'basic', nameEn: 'Basic', priceMonthly: 299 },
};

const DUNNING_LOG: DunningLogRow = {
  id: 'log-1',
  subscriptionId: 'sub-1',
  attemptNumber: 1,
  status: 'failed',
  executedAt: '2026-04-06T00:00:00Z',
  scheduledFor: '2026-04-06T00:00:00Z',
  failureReason: 'card_declined',
};

describe('BillingHealthCard', () => {
  it('renders force-charge button when subscription is PAST_DUE', () => {
    wrap(
      <BillingHealthCard orgId="org-1" subscription={BASE_SUB} dunningLogs={[DUNNING_LOG]} />,
    );
    expect(screen.getByRole('button', { name: /force charge now/i })).toBeDefined();
  });

  it('renders cancel-scheduled button when cancelAtPeriodEnd is true', () => {
    wrap(
      <BillingHealthCard
        orgId="org-1"
        subscription={{ ...BASE_SUB, status: 'ACTIVE', cancelAtPeriodEnd: true }}
        dunningLogs={[]}
      />,
    );
    expect(screen.getByRole('button', { name: /cancel scheduled cancellation/i })).toBeDefined();
  });
});
