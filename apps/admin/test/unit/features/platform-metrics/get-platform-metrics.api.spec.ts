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

describe('get-platform-metrics.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls adminRequest with correct URL path', async () => {
    const { getPlatformMetrics } = await import('@/features/platform-metrics/get-platform-metrics/get-platform-metrics.api');
    mockApiRequest.mockResolvedValue({ organizations: { total: 0, active: 0, suspended: 0, newThisMonth: 0 }, users: { total: 0 }, bookings: { totalLast30Days: 0 }, revenue: { lifetimePaidSar: 0 }, subscriptions: { byPlan: {}, byStatus: {} } });

    await getPlatformMetrics();

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/metrics/platform', {});
  });

  it('uses default GET method', async () => {
    const { getPlatformMetrics } = await import('@/features/platform-metrics/get-platform-metrics/get-platform-metrics.api');
    mockApiRequest.mockResolvedValue({ organizations: { total: 0, active: 0, suspended: 0, newThisMonth: 0 }, users: { total: 0 }, bookings: { totalLast30Days: 0 }, revenue: { lifetimePaidSar: 0 }, subscriptions: { byPlan: {}, byStatus: {} } });

    await getPlatformMetrics();

    const call = mockApiRequest.mock.calls[0] as [string, RequestInit?];
    expect(call[1]).toEqual({});
  });

  it('returns typed PlatformMetrics', async () => {
    const { getPlatformMetrics } = await import('@/features/platform-metrics/get-platform-metrics/get-platform-metrics.api');
    const mockMetrics = {
      organizations: { total: 100, active: 80, suspended: 5, newThisMonth: 10 },
      users: { total: 500 },
      bookings: { totalLast30Days: 1200 },
      revenue: { lifetimePaidSar: 500000 },
      subscriptions: { byPlan: { 'plan-pro': 40 }, byStatus: { ACTIVE: 70 } },
    };
    mockApiRequest.mockResolvedValue(mockMetrics);

    const result = await getPlatformMetrics();

    expect(result.organizations.total).toBe(100);
    expect(result.revenue.lifetimePaidSar).toBe(500000);
  });
});
