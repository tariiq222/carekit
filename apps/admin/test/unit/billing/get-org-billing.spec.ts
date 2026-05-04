import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { useGetOrgBilling } from '@/features/billing/get-org-billing/use-get-org-billing';
import type { OrgBillingDetail } from '@/features/billing/types';

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

const MOCK_ORG_BILLING: OrgBillingDetail = {
  org: {
    id: 'org-1',
    slug: 'riyadh-clinic',
    nameAr: 'عيادة الرياض',
    nameEn: 'Riyadh Clinic',
    status: 'ACTIVE',
  },
  subscription: {
    id: 'sub-1',
    organizationId: 'org-1',
    organization: {
      id: 'org-1',
      slug: 'riyadh-clinic',
      nameAr: 'عيادة الرياض',
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
  },
  invoices: [],
  usage: [],
  credits: [],
  dunningLogs: [],
};

describe('useGetOrgBilling', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('fetches org billing detail from correct endpoint', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG_BILLING);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrgBilling('org-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/billing/subscriptions/org-1');
  });

  it('returns data equal to the API response', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG_BILLING);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrgBilling('org-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_ORG_BILLING);
  });

  it('is disabled (does not fetch) when orgId is empty string', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG_BILLING);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrgBilling(''), { wrapper });

    // Give a tick for potential fetch
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.isLoading).toBe(false);
    expect(adminRequest).not.toHaveBeenCalled();
  });

  it('uses keyed query cache entry per orgId', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG_BILLING);
    const { wrapper, queryClient } = makeWrapper();

    const { result } = renderHook(() => useGetOrgBilling('org-42'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(['billing', 'org', 'org-42']);
    expect(cached).toEqual(MOCK_ORG_BILLING);
  });

  it('surfaces error when API rejects', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('not_found'));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrgBilling('org-missing'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
