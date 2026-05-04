import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { useGetOrgBilling } from '@/features/organizations/get-org-billing/use-get-org-billing';
import type { OrgBillingResponse } from '@/features/organizations/get-org-billing/get-org-billing.api';

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

const MOCK_BILLING_RESPONSE: OrgBillingResponse = {
  org: {
    id: 'org-billing-1',
    slug: 'clinic-slug',
    nameAr: 'عيادة',
    nameEn: 'Clinic',
    status: 'ACTIVE',
  },
  subscription: {
    id: 'sub-1',
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    currentPeriodStart: '2026-05-01T00:00:00Z',
    currentPeriodEnd: '2026-05-31T00:00:00Z',
    planId: 'plan-1',
    plan: {
      slug: 'basic',
      nameEn: 'Basic',
      priceMonthly: '299.00',
    },
  },
};

const MOCK_BILLING_NO_SUB: OrgBillingResponse = {
  org: {
    id: 'org-billing-2',
    slug: 'clinic-nosub',
    nameAr: 'عيادة بلا اشتراك',
    nameEn: null,
    status: 'TRIALING',
  },
  subscription: null,
};

describe('useGetOrgBilling (organizations cluster)', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('fetches from /billing/subscriptions/:orgId', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrgBilling('org-billing-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/billing/subscriptions/org-billing-1');
  });

  it('returns org and subscription data on success', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrgBilling('org-billing-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.org.slug).toBe('clinic-slug');
    expect(result.current.data?.subscription?.plan.slug).toBe('basic');
    expect(result.current.data?.subscription?.billingCycle).toBe('MONTHLY');
  });

  it('returns subscription as null when organization has no subscription', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_NO_SUB);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrgBilling('org-billing-2'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.subscription).toBeNull();
  });

  it('uses queryKey ["org-billing", orgId]', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_RESPONSE);
    const { wrapper, queryClient } = makeWrapper();

    const { result } = renderHook(() => useGetOrgBilling('org-key-test'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cache = queryClient.getQueryCache();
    const query = cache.find({ queryKey: ['org-billing', 'org-key-test'] });
    expect(query).toBeDefined();
  });

  it('exposes isError=true on fetch failure', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('not_found'));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrgBilling('org-err'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('has staleTime of 30 seconds (data is not immediately stale)', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_BILLING_RESPONSE);
    const { wrapper, queryClient } = makeWrapper();

    const { result } = renderHook(() => useGetOrgBilling('org-stale'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cache = queryClient.getQueryCache();
    const query = cache.find({ queryKey: ['org-billing', 'org-stale'] });
    // staleTime=30_000 means data is not stale immediately after fetching
    expect(query?.isStale()).toBe(false);
  });
});
