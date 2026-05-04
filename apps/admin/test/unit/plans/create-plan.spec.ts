import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { adminRequest } from '@/lib/api-client';
import { useCreatePlan } from '@/features/plans/create-plan/use-create-plan';

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

const CREATE_CMD = {
  slug: 'basic',
  nameAr: 'أساسي',
  nameEn: 'Basic',
  priceMonthly: 99,
  priceAnnual: 999,
  limits: {},
  reason: 'Creating initial plan',
};

describe('useCreatePlan', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('posts to /plans with correct body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN);

    const { result } = renderHook(() => useCreatePlan(), { wrapper });
    result.current.mutate(CREATE_CMD);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/plans', {
      method: 'POST',
      body: JSON.stringify(CREATE_CMD),
    });
  });

  it('calls toast.success("Plan created.") on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN);

    const { result } = renderHook(() => useCreatePlan(), { wrapper });
    result.current.mutate(CREATE_CMD);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Plan created.');
  });

  it('invalidates plans list query on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN);

    const { result } = renderHook(() => useCreatePlan(), { wrapper });
    result.current.mutate(CREATE_CMD);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['plans', 'list'] }),
    );
  });

  it('calls toast.error with error message on failure', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('slug_already_exists'));

    const { result } = renderHook(() => useCreatePlan(), { wrapper });
    result.current.mutate(CREATE_CMD);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('slug_already_exists');
  });

  it('calls toast.error with fallback message for non-Error rejection', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('raw_error');

    const { result } = renderHook(() => useCreatePlan(), { wrapper });
    result.current.mutate(CREATE_CMD);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to create plan');
  });
});
