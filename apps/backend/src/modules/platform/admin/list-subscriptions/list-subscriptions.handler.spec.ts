import { Test } from '@nestjs/testing';
import { SubscriptionStatus } from '@prisma/client';
import { ListSubscriptionsHandler } from './list-subscriptions.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('ListSubscriptionsHandler', () => {
  let handler: ListSubscriptionsHandler;
  let findMany: jest.Mock;
  let count: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn();
    count = jest.fn();
    const prismaMock = {
      $allTenants: { subscription: { findMany, count } },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListSubscriptionsHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    handler = moduleRef.get(ListSubscriptionsHandler);
  });

  it('returns paginated subs across all tenants', async () => {
    findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
    count.mockResolvedValue(2);

    const result = await handler.execute({ page: 1, perPage: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20, orderBy: { currentPeriodEnd: 'desc' } }),
    );
  });

  it('filters by status', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20, status: SubscriptionStatus.PAST_DUE });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: SubscriptionStatus.PAST_DUE } }),
    );
  });

  it('filters by planId', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20, planId: 'p1' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { planId: 'p1' } }),
    );
  });

  it('paginates with skip/take', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(45);

    const result = await handler.execute({ page: 3, perPage: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
    expect(result.meta.totalPages).toBe(3);
  });

  it('totalPages = 0 when total = 0', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const result = await handler.execute({ page: 1, perPage: 20 });
    expect(result.meta.totalPages).toBe(0);
  });
});
