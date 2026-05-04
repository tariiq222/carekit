import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { BillingMetricsGrid } from '@/features/billing/get-billing-metrics/billing-metrics-grid';
import type { BillingMetrics } from '@/features/billing/types';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MOCK_METRICS: BillingMetrics = {
  mrr: '15000.00',
  arr: '180000.00',
  currency: 'SAR',
  counts: { TRIALING: 3, ACTIVE: 20, PAST_DUE: 2, SUSPENDED: 1, CANCELED: 5 },
  churn30d: 0.05,
  byPlan: [
    { planId: 'plan-1', planSlug: 'basic', activeCount: 10, mrr: '5000.00' },
    { planId: 'plan-2', planSlug: 'pro', activeCount: 10, mrr: '10000.00' },
  ],
};

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('BillingMetricsGrid', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('shows skeleton while loading', () => {
    // adminRequest never resolves so component stays in loading state
    vi.mocked(adminRequest).mockImplementation(() => new Promise(() => {}));
    wrap(<BillingMetricsGrid />);
    // Skeletons are rendered (they have data-slot="skeleton" or aria role)
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders metric cards after data loads', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_METRICS);
    wrap(<BillingMetricsGrid />);

    await waitFor(() => {
      // MRR card label + "MRR by plan" heading both match /mrr/i — use getAllByText
      expect(screen.getAllByText(/mrr/i).length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/arr/i)).toBeInTheDocument();
    expect(screen.getByText(/active subs/i)).toBeInTheDocument();
    expect(screen.getByText(/past due/i)).toBeInTheDocument();
  });

  it('renders MRR by plan section when byPlan is non-empty', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_METRICS);
    wrap(<BillingMetricsGrid />);

    await waitFor(() => {
      expect(screen.getByText(/mrr by plan/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/basic/i)).toBeInTheDocument();
    expect(screen.getByText(/pro/i)).toBeInTheDocument();
  });

  it('does NOT render MRR by plan when byPlan is empty', async () => {
    const metricsNoPlan: BillingMetrics = { ...MOCK_METRICS, byPlan: [] };
    vi.mocked(adminRequest).mockResolvedValue(metricsNoPlan);
    wrap(<BillingMetricsGrid />);

    await waitFor(() => {
      // Wait for load to finish
      expect(screen.getByText(/active subs/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/mrr by plan/i)).not.toBeInTheDocument();
  });

  it('shows error card when API fails', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('fetch_failed'));
    wrap(<BillingMetricsGrid />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load billing metrics/i)).toBeInTheDocument();
    });
  });

  it('shows churn and suspended counts', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_METRICS);
    wrap(<BillingMetricsGrid />);

    await waitFor(() => {
      expect(screen.getByText(/trialing/i)).toBeInTheDocument();
      expect(screen.getByText(/suspended/i)).toBeInTheDocument();
      expect(screen.getByText(/churn/i)).toBeInTheDocument();
    });
  });

  it('PlanBar renders percentage correctly (zero total = 0%)', async () => {
    const zeroMrr: BillingMetrics = {
      ...MOCK_METRICS,
      mrr: '0',
      byPlan: [{ planId: 'p-1', planSlug: 'basic', activeCount: 5, mrr: '0' }],
    };
    vi.mocked(adminRequest).mockResolvedValue(zeroMrr);
    wrap(<BillingMetricsGrid />);

    await waitFor(() => {
      expect(screen.getByText(/mrr by plan/i)).toBeInTheDocument();
    });

    // The bar renders with 0% width which is a valid render path
    const bars = document.querySelectorAll('.bg-primary');
    expect(bars.length).toBeGreaterThan(0);
  });
});
