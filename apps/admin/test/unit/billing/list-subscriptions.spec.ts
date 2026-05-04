import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { useListSubscriptions } from '@/features/billing/list-subscriptions/use-list-subscriptions';
import type {
  ListSubscriptionsParams,
  ListSubscriptionsResponse,
} from '@/features/billing/list-subscriptions/list-subscriptions.api';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper };
}

const MOCK_RESPONSE: ListSubscriptionsResponse = {
  items: [],
  meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
};

describe('useListSubscriptions', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('fetches with page and perPage params', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListSubscriptionsParams = { page: 1, perPage: 20 };
    const { result } = renderHook(() => useListSubscriptions(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/billing/subscriptions?page=1&perPage=20');
  });

  it('includes status in query string when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListSubscriptionsParams = { page: 1, perPage: 10, status: 'PAST_DUE' };
    const { result } = renderHook(() => useListSubscriptions(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith(
      expect.stringContaining('status=PAST_DUE'),
    );
  });

  it('includes planId in query string when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListSubscriptionsParams = { page: 1, perPage: 10, planId: 'plan-42' };
    const { result } = renderHook(() => useListSubscriptions(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith(
      expect.stringContaining('planId=plan-42'),
    );
  });

  it('does NOT include planId when not provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListSubscriptionsParams = { page: 1, perPage: 10 };
    const { result } = renderHook(() => useListSubscriptions(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).not.toContain('planId');
  });

  it('returns response data', async () => {
    const response: ListSubscriptionsResponse = {
      items: [],
      meta: { page: 3, perPage: 5, total: 30, totalPages: 6 },
    };
    vi.mocked(adminRequest).mockResolvedValue(response);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListSubscriptions({ page: 3, perPage: 5 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
  });

  it('surfaces error when API rejects', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('server_error'));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListSubscriptions({ page: 1, perPage: 10 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
