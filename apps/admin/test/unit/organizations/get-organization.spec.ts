import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { useGetOrganization } from '@/features/organizations/get-organization/use-get-organization';
import type { OrganizationDetail } from '@/features/organizations/types';

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

const MOCK_ORG_DETAIL: OrganizationDetail = {
  id: 'org-detail-1',
  slug: 'test-clinic',
  nameAr: 'عيادة الاختبار',
  nameEn: 'Test Clinic',
  status: 'ACTIVE',
  verticalId: 'vert-1',
  trialEndsAt: null,
  suspendedAt: null,
  suspendedReason: null,
  createdAt: '2026-01-01T00:00:00Z',
  subscription: {
    status: 'ACTIVE',
    plan: { slug: 'basic', nameEn: 'Basic' },
  },
  stats: {
    memberCount: 12,
    bookingCount30d: 45,
    totalRevenue: 5000,
  },
};

describe('useGetOrganization', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('fetches from /organizations/:id', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG_DETAIL);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrganization('org-detail-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/organizations/org-detail-1');
  });

  it('returns organization detail with stats on success', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG_DETAIL);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrganization('org-detail-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(MOCK_ORG_DETAIL);
    expect(result.current.data?.stats.memberCount).toBe(12);
    expect(result.current.data?.stats.bookingCount30d).toBe(45);
  });

  it('uses queryKey ["organizations", "detail", id]', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG_DETAIL);
    const { wrapper, queryClient } = makeWrapper();

    const { result } = renderHook(() => useGetOrganization('org-key-test'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cache = queryClient.getQueryCache();
    const query = cache.find({ queryKey: ['organizations', 'detail', 'org-key-test'] });
    expect(query).toBeDefined();
  });

  it('exposes isLoading=true while fetching', () => {
    vi.mocked(adminRequest).mockReturnValue(new Promise(() => {}));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrganization('org-pending'), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('exposes isError=true on fetch failure', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('not_found'));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrganization('org-err'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('returns data with subscription info when present', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG_DETAIL);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useGetOrganization('org-detail-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.subscription?.plan.slug).toBe('basic');
  });
});
