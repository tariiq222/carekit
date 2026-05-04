import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { adminRequest } from '@/lib/api-client';
import { useEndImpersonation } from '@/features/impersonation/end-impersonation/use-end-impersonation';

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

describe('useEndImpersonation hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('POSTs to /impersonation/:sessionId/end', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useEndImpersonation(), { wrapper });
    result.current.mutate('session-abc-123');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/impersonation/session-abc-123/end', {
      method: 'POST',
    });
  });

  it('calls toast.success("Impersonation session ended.") on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useEndImpersonation(), { wrapper });
    result.current.mutate('session-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Impersonation session ended.');
  });

  it('invalidates ["impersonation-sessions"] query on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useEndImpersonation(), { wrapper });
    result.current.mutate('session-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['impersonation-sessions'] }),
    );
  });

  it('calls toast.error with error message on failure', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('session_not_found'));

    const { result } = renderHook(() => useEndImpersonation(), { wrapper });
    result.current.mutate('session-bad');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('session_not_found');
  });

  it('calls toast.error with fallback when error is not an Error instance', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('string error');

    const { result } = renderHook(() => useEndImpersonation(), { wrapper });
    result.current.mutate('session-bad');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to end session');
  });

  it('uses the sessionId as the mutationFn parameter', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useEndImpersonation(), { wrapper });
    result.current.mutate('unique-session-xyz');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith(
      '/impersonation/unique-session-xyz/end',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
