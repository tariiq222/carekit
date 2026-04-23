import { Test } from '@nestjs/testing';
import { SubscriptionInvoiceStatus } from '@prisma/client';
import { ListSubscriptionInvoicesHandler } from './list-subscription-invoices.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('ListSubscriptionInvoicesHandler', () => {
  let handler: ListSubscriptionInvoicesHandler;
  let findMany: jest.Mock;
  let count: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn();
    count = jest.fn();
    const prismaMock = {
      $allTenants: { subscriptionInvoice: { findMany, count } },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListSubscriptionInvoicesHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    handler = moduleRef.get(ListSubscriptionInvoicesHandler);
  });

  it('excludes drafts by default', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: SubscriptionInvoiceStatus.DRAFT } },
      }),
    );
  });

  it('includes drafts when includeDrafts=true', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20, includeDrafts: true });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('explicit status overrides default exclude-drafts', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20, status: SubscriptionInvoiceStatus.PAID });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: SubscriptionInvoiceStatus.PAID } }),
    );
  });

  it('filters by organizationId', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20, organizationId: 'o1' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'o1' }),
      }),
    );
  });

  it('filters by date range', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    const fromDate = new Date('2026-01-01');
    const toDate = new Date('2026-04-01');

    await handler.execute({ page: 1, perPage: 20, fromDate, toDate });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: fromDate, lte: toDate } }),
      }),
    );
  });

  it('paginates', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(45);

    const result = await handler.execute({ page: 3, perPage: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
    expect(result.meta.totalPages).toBe(3);
  });
});
