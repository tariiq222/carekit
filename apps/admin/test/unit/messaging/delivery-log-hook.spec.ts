import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import {
  useListDeliveryLog,
  deliveryLogKey,
} from '@/features/notifications/list-delivery-log/use-list-delivery-log';
import type { DeliveryLogFilters } from '@/features/notifications/list-delivery-log/list-delivery-log.api';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
    queryClient,
  };
}

const MOCK_RESPONSE = {
  items: [],
  meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
};

describe('useListDeliveryLog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('fetches delivery log on mount', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useListDeliveryLog({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith('/notifications/delivery-log');
  });

  it('returns data from the API', async () => {
    const response = {
      items: [
        {
          id: 'dl-1', organizationId: 'org-1', recipientId: 'user-1',
          type: 'BOOKING_CONFIRMED', priority: 'STANDARD' as const,
          channel: 'EMAIL' as const, status: 'SENT' as const,
          toAddress: 'owner@clinic.sa', providerName: 'resend',
          attempts: 1, lastAttemptAt: null, sentAt: null,
          errorMessage: null, jobId: null, createdAt: '2026-05-01T00:00:00Z',
        },
      ],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    };
    vi.mocked(adminRequest).mockResolvedValue(response);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useListDeliveryLog({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
  });

  it('passes filters to the API call', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();
    const filters: DeliveryLogFilters = {
      organizationId: 'org-xyz',
      status: 'FAILED',
      channel: 'EMAIL',
      page: 2,
      perPage: 20,
    };
    const { result } = renderHook(() => useListDeliveryLog(filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).toContain('organizationId=org-xyz');
    expect(url).toContain('status=FAILED');
    expect(url).toContain('channel=EMAIL');
  });

  it('surfaces error when API rejects', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('network_error'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useListDeliveryLog({}), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('network_error');
  });

  it('uses default empty filters when called with no argument', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useListDeliveryLog(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith('/notifications/delivery-log');
  });
});

describe('deliveryLogKey', () => {
  it('returns query key array with filters', () => {
    const filters: DeliveryLogFilters = { status: 'SENT', page: 1 };
    expect(deliveryLogKey(filters)).toEqual(['notifications', 'delivery-log', filters]);
  });

  it('returns different keys for different filters', () => {
    const key1 = deliveryLogKey({ status: 'SENT' });
    const key2 = deliveryLogKey({ status: 'FAILED' });
    expect(key1).not.toEqual(key2);
  });
});
