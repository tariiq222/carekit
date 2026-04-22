import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { from, throwError } from 'rxjs';
import { UsageTrackerInterceptor } from './usage-tracker.interceptor';
import { UsageAggregatorService } from './usage-aggregator.service';

describe('UsageTrackerInterceptor', () => {
  const mockReflector = { get: jest.fn() };
  const mockTenant = { requireOrganizationId: jest.fn().mockReturnValue('org-1') };
  const mockCache = { get: jest.fn() };
  let aggregator: UsageAggregatorService;
  let interceptor: UsageTrackerInterceptor;

  const mockCtx = { getHandler: () => ({}) } as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTenant.requireOrganizationId.mockReturnValue('org-1');
    aggregator = new UsageAggregatorService();
    interceptor = new UsageTrackerInterceptor(
      mockReflector as never,
      mockTenant as never,
      mockCache as never,
      aggregator,
    );
  });

  it('passes through when no @TrackUsage decorator', async () => {
    mockReflector.get.mockReturnValue(undefined);
    const next = { handle: jest.fn().mockReturnValue(from([{}])) };
    const result = await interceptor.intercept(mockCtx, next as never);
    expect(next.handle).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('allows and increments counter on successful BOOKINGS_PER_MONTH create', async () => {
    mockReflector.get.mockReturnValue('BOOKINGS_PER_MONTH');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: {} });
    const next = { handle: jest.fn().mockReturnValue(from([{ id: 'booking-1' }])) };

    const obs = await interceptor.intercept(mockCtx, next as never);

    await new Promise<void>((resolve, reject) => {
      obs.subscribe({ next: () => undefined, error: reject, complete: resolve });
    });

    expect(aggregator.getCount('org-1', 'BOOKINGS_PER_MONTH')).toBe(1);
  });

  it('does NOT increment when next.handle throws error', async () => {
    mockReflector.get.mockReturnValue('BOOKINGS_PER_MONTH');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: {} });
    const next = { handle: jest.fn().mockReturnValue(throwError(() => new Error('DB error'))) };

    const obs = await interceptor.intercept(mockCtx, next as never);

    await new Promise<void>((resolve) => {
      obs.subscribe({ next: () => undefined, error: () => resolve(), complete: resolve });
    });

    expect(aggregator.getCount('org-1', 'BOOKINGS_PER_MONTH')).toBe(0);
  });

  it('throws ForbiddenException when subscription is SUSPENDED', async () => {
    mockReflector.get.mockReturnValue('BOOKINGS_PER_MONTH');
    mockCache.get.mockResolvedValue({ status: 'SUSPENDED', limits: {} });
    const next = { handle: jest.fn().mockReturnValue(from([{}])) };

    await expect(interceptor.intercept(mockCtx, next as never)).rejects.toThrow(ForbiddenException);
    await expect(interceptor.intercept(mockCtx, next as never)).rejects.toThrow('Subscription is SUSPENDED');
  });

  it('throws ForbiddenException when subscription is CANCELED', async () => {
    mockReflector.get.mockReturnValue('CLIENTS');
    mockCache.get.mockResolvedValue({ status: 'CANCELED', limits: {} });
    const next = { handle: jest.fn().mockReturnValue(from([{}])) };

    await expect(interceptor.intercept(mockCtx, next as never)).rejects.toThrow(ForbiddenException);
    await expect(interceptor.intercept(mockCtx, next as never)).rejects.toThrow('Subscription is CANCELED');
  });

  it('allows when no subscription cached (returns handle())', async () => {
    mockReflector.get.mockReturnValue('CLIENTS');
    mockCache.get.mockResolvedValue(null);
    const next = { handle: jest.fn().mockReturnValue(from([{ id: 'client-1' }])) };

    const obs = await interceptor.intercept(mockCtx, next as never);

    await new Promise<void>((resolve, reject) => {
      obs.subscribe({ next: () => undefined, error: reject, complete: resolve });
    });

    expect(aggregator.getCount('org-1', 'CLIENTS')).toBe(1);
  });

  it('STORAGE_MB increments by Math.ceil(sizeBytes / 1024 / 1024)', async () => {
    mockReflector.get.mockReturnValue('STORAGE_MB');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: {} });
    // 2.5 MB = 2621440 bytes → ceil = 3
    const next = { handle: jest.fn().mockReturnValue(from([{ sizeBytes: 2621440 }])) };

    const obs = await interceptor.intercept(mockCtx, next as never);

    await new Promise<void>((resolve, reject) => {
      obs.subscribe({ next: () => undefined, error: reject, complete: resolve });
    });

    expect(aggregator.getCount('org-1', 'STORAGE_MB')).toBe(3);
  });
});
