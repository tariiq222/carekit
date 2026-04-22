import { Test } from '@nestjs/testing';
import { GetPlatformMetricsHandler } from './get-platform-metrics.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('GetPlatformMetricsHandler', () => {
  it('aggregates platform-wide metrics from $allTenants', async () => {
    const orgCount = jest.fn();
    orgCount
      .mockResolvedValueOnce(100) // totalOrgs
      .mockResolvedValueOnce(95) // activeOrgs
      .mockResolvedValueOnce(5) // suspendedOrgs
      .mockResolvedValueOnce(7); // newOrgs
    const userCount = jest.fn().mockResolvedValue(800);
    const bookingCount = jest.fn().mockResolvedValue(2400);
    const invoiceAggregate = jest.fn().mockResolvedValue({ _sum: { amount: 125000 } });
    const subGroupByPlan = jest.fn().mockResolvedValue([
      { planId: 'p1', _count: 60 },
      { planId: 'p2', _count: 35 },
    ]);
    const subGroupByStatus = jest.fn().mockResolvedValue([
      { status: 'ACTIVE', _count: 80 },
      { status: 'PAST_DUE', _count: 5 },
    ]);

    const prismaMock = {
      $allTenants: {
        organization: { count: orgCount },
        user: { count: userCount },
        booking: { count: bookingCount },
        subscriptionInvoice: { aggregate: invoiceAggregate },
        subscription: {
          groupBy: jest
            .fn()
            .mockImplementationOnce(subGroupByPlan)
            .mockImplementationOnce(subGroupByStatus),
        },
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetPlatformMetricsHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    const handler = moduleRef.get(GetPlatformMetricsHandler);

    const result = await handler.execute();

    expect(result.organizations).toEqual({
      total: 100,
      active: 95,
      suspended: 5,
      newThisMonth: 7,
    });
    expect(result.users.total).toBe(800);
    expect(result.bookings.totalLast30Days).toBe(2400);
    expect(result.revenue.lifetimePaidSar).toBe(125000);
    expect(result.subscriptions.byPlan).toEqual({ p1: 60, p2: 35 });
    expect(result.subscriptions.byStatus).toEqual({ ACTIVE: 80, PAST_DUE: 5 });
  });

  it('returns 0 revenue when no PAID invoices', async () => {
    const orgCount = jest.fn().mockResolvedValue(0);
    const prismaMock = {
      $allTenants: {
        organization: { count: orgCount },
        user: { count: jest.fn().mockResolvedValue(0) },
        booking: { count: jest.fn().mockResolvedValue(0) },
        subscriptionInvoice: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
        subscription: { groupBy: jest.fn().mockResolvedValue([]) },
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetPlatformMetricsHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    const handler = moduleRef.get(GetPlatformMetricsHandler);

    const result = await handler.execute();

    expect(result.revenue.lifetimePaidSar).toBe(0);
    expect(result.subscriptions.byPlan).toEqual({});
  });
});
