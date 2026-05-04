import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { useForceCharge } from '@/features/billing/force-charge/use-force-charge';

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

const FORCE_RESULT = {
  success: true,
  message: 'Charged',
  result: { ok: true, status: 'succeeded', attemptNumber: 1 },
};

describe('useForceCharge', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('calls the correct API endpoint on mutate', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(FORCE_RESULT);

    const { result } = renderHook(() => useForceCharge('org-fc'), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith(
      '/billing/subscriptions/org-fc/force-charge',
      { method: 'POST' },
    );
  });

  it('invalidates org billing query on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(FORCE_RESULT);

    const { result } = renderHook(() => useForceCharge('org-fc2'), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['billing', 'org', 'org-fc2'] }),
    );
  });

  it('surfaces error when API rejects', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('payment_failed'));

    const { result } = renderHook(() => useForceCharge('org-err'), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('returns data from the API on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(FORCE_RESULT);

    const { result } = renderHook(() => useForceCharge('org-data'), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(FORCE_RESULT);
  });
});
