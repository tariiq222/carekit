import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { adminRequest } from '@/lib/api-client';
import { useUpdatePlan } from '@/features/plans/update-plan/use-update-plan';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient, invalidateSpy };
}

const MOCK_PLAN = {
  id: 'plan-001',
  slug: 'basic',
  nameAr: 'أساسي',
  nameEn: 'Basic',
  priceMonthly: 99,
  priceAnnual: 999,
  currency: 'SAR',
  isActive: true,
  isVisible: true,
  sortOrder: 1,
  limits: {},
  createdAt: '2026-01-01T00:00:00Z',
  _count: { subscriptions: 0 },
};

describe('useUpdatePlan', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('sends PATCH to /plans/:planId with body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN);

    const { result } = renderHook(() => useUpdatePlan(), { wrapper });
    result.current.mutate({
      planId: 'plan-001',
      nameEn: 'Basic Updated',
      reason: 'Updating plan name for clarity',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/plans/plan-001', {
      method: 'PATCH',
      body: JSON.stringify({ nameEn: 'Basic Updated', reason: 'Updating plan name for clarity' }),
    });
  });

  it('calls toast.success("Plan updated.") on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN);

    const { result } = renderHook(() => useUpdatePlan(), { wrapper });
    result.current.mutate({ planId: 'plan-001', reason: 'Any reason here' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Plan updated.');
  });

  it('invalidates plans list query on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN);

    const { result } = renderHook(() => useUpdatePlan(), { wrapper });
    result.current.mutate({ planId: 'plan-001', reason: 'Invalidation test reason' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['plans', 'list'] }),
    );
  });

  it('calls toast.error with error message on failure', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('plan_not_found'));

    const { result } = renderHook(() => useUpdatePlan(), { wrapper });
    result.current.mutate({ planId: 'plan-bad', reason: 'Trigger failure here' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('plan_not_found');
  });

  it('calls toast.error with fallback for non-Error rejection', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('network_down');

    const { result } = renderHook(() => useUpdatePlan(), { wrapper });
    result.current.mutate({ planId: 'plan-001', reason: 'Fallback error test' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to update plan');
  });

  it('passes limits in body when provided', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN);

    const limits = { maxBranches: 5 };
    const { result } = renderHook(() => useUpdatePlan(), { wrapper });
    result.current.mutate({ planId: 'plan-001', limits, reason: 'Updating plan limits here' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = vi.mocked(adminRequest).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.limits).toEqual(limits);
    expect(body.reason).toBe('Updating plan limits here');
  });
});
