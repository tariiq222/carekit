import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { useListSubscriptionInvoices } from '@/features/billing/list-subscription-invoices/use-list-subscription-invoices';
import type { ListSubscriptionInvoicesParams } from '@/features/billing/list-subscription-invoices/list-subscription-invoices.api';
import type { ListSubscriptionInvoicesResponse } from '@/features/billing/list-subscription-invoices/list-subscription-invoices.api';

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

const MOCK_RESPONSE: ListSubscriptionInvoicesResponse = {
  items: [],
  meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
};

describe('useListSubscriptionInvoices', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('fetches with page and perPage params', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListSubscriptionInvoicesParams = { page: 1, perPage: 20 };
    const { result } = renderHook(() => useListSubscriptionInvoices(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/billing/invoices?page=1&perPage=20');
  });

  it('includes status in query string when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListSubscriptionInvoicesParams = { page: 1, perPage: 10, status: 'PAID' };
    const { result } = renderHook(() => useListSubscriptionInvoices(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith(
      expect.stringContaining('status=PAID'),
    );
  });

  it('includes organizationId in query string when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListSubscriptionInvoicesParams = {
      page: 1,
      perPage: 10,
      organizationId: 'org-99',
    };
    const { result } = renderHook(() => useListSubscriptionInvoices(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith(
      expect.stringContaining('organizationId=org-99'),
    );
  });

  it('includes fromDate and toDate in query string when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListSubscriptionInvoicesParams = {
      page: 1,
      perPage: 10,
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
    };
    const { result } = renderHook(() => useListSubscriptionInvoices(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).toContain('fromDate=2026-04-01');
    expect(url).toContain('toDate=2026-04-30');
  });

  it('includes includeDrafts=true when set', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListSubscriptionInvoicesParams = {
      page: 1,
      perPage: 10,
      includeDrafts: true,
    };
    const { result } = renderHook(() => useListSubscriptionInvoices(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith(
      expect.stringContaining('includeDrafts=true'),
    );
  });

  it('does NOT include includeDrafts when false', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListSubscriptionInvoicesParams = {
      page: 1,
      perPage: 10,
      includeDrafts: false,
    };
    const { result } = renderHook(() => useListSubscriptionInvoices(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).not.toContain('includeDrafts');
  });

  it('returns response data', async () => {
    const response: ListSubscriptionInvoicesResponse = {
      items: [],
      meta: { page: 2, perPage: 5, total: 15, totalPages: 3 },
    };
    vi.mocked(adminRequest).mockResolvedValue(response);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListSubscriptionInvoices({ page: 2, perPage: 5 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
  });
});
