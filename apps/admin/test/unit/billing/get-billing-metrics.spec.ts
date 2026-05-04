import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { useGetBillingMetrics } from '@/features/billing/get-billing-metrics/use-get-billing-metrics';
import type { BillingMetrics } from '@/features/billing/types';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

const MOCK_METRICS: BillingMetrics = {
  mrr: '15000.00',
  arr: '180000.00',
  currency: 'SAR',
  counts: {
    TRIALING: 3,
    ACTIVE: 20,
    PAST_DUE: 2,
    SUSPENDED: 1,
    CANCELED: 5,
  },
  churn30d: 0.05,
  byPlan: [
    { planId: 'plan-1', planSlug: 'basic', activeCount: 10, mrr: '5000.00' },
    { planId: 'plan-2', planSlug: 'pro', activeCount: 10, mrr: '10000.00' },
  ],
};

describe('useGetBillingMetrics', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('fetches billing metrics from correct endpoint', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_METRICS);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetBillingMetrics(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/billing/metrics');
  });

  it('returns data equal to the API response', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_METRICS);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetBillingMetrics(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_METRICS);
  });

  it('surfaces error when API rejects', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('unauthorized'));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetBillingMetrics(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('uses the stable billing metrics query key', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_METRICS);
    const { wrapper, queryClient } = makeWrapper();

    const { result } = renderHook(() => useGetBillingMetrics(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(['billing', 'metrics']);
    expect(cached).toEqual(MOCK_METRICS);
  });
});
