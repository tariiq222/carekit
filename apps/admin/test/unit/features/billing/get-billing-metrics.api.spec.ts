import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiRequest = vi.hoisted(() => vi.fn());

vi.mock('@deqah/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deqah/api-client')>();
  return {
    ...actual,
    apiRequest: mockApiRequest,
    ApiError: actual.ApiError,
  };
});

describe('get-billing-metrics.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls adminRequest with correct URL path', async () => {
    const { getBillingMetrics } = await import('@/features/billing/get-billing-metrics/get-billing-metrics.api');
    mockApiRequest.mockResolvedValue({ mrr: 0, arr: 0, activeSubscriptions: 0, churnedThisMonth: 0 });

    await getBillingMetrics();

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/billing/metrics', {});
  });

  it('uses default GET method', async () => {
    const { getBillingMetrics } = await import('@/features/billing/get-billing-metrics/get-billing-metrics.api');
    mockApiRequest.mockResolvedValue({ mrr: 0, arr: 0, activeSubscriptions: 0, churnedThisMonth: 0 });

    await getBillingMetrics();

    const call = mockApiRequest.mock.calls[0] as [string, RequestInit?];
    expect(call[1]).toEqual({});
  });

  it('returns typed BillingMetrics', async () => {
    const { getBillingMetrics } = await import('@/features/billing/get-billing-metrics/get-billing-metrics.api');
    const mockMetrics = { mrr: 50000, arr: 600000, activeSubscriptions: 100, churnedThisMonth: 2 };
    mockApiRequest.mockResolvedValue(mockMetrics);

    const result = await getBillingMetrics();

    expect(result.mrr).toBe(50000);
    expect(result.activeSubscriptions).toBe(100);
  });
});
