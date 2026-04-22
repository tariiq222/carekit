import { Test } from '@nestjs/testing';
import { ListAuditLogHandler } from './list-audit-log.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('ListAuditLogHandler', () => {
  let handler: ListAuditLogHandler;
  let findMany: jest.Mock;
  let count: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn();
    count = jest.fn();
    const prismaMock = {
      $allTenants: { superAdminActionLog: { findMany, count } },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListAuditLogHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    handler = moduleRef.get(ListAuditLogHandler);
  });

  it('returns paginated audit log entries', async () => {
    findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    count.mockResolvedValue(2);

    const result = await handler.execute({ page: 1, perPage: 50 });

    expect(result.items).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, skip: 0, take: 50 }),
    );
  });

  it('filters by actionType', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 50, actionType: 'SUSPEND_ORG' as never });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actionType: 'SUSPEND_ORG' } }),
    );
  });

  it('filters by superAdminUserId + organizationId', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({
      page: 1,
      perPage: 50,
      superAdminUserId: 'sa1',
      organizationId: 'o1',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { superAdminUserId: 'sa1', organizationId: 'o1' },
      }),
    );
  });

  it('filters by date range', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    const from = new Date('2026-01-01');
    const to = new Date('2026-04-01');

    await handler.execute({ page: 1, perPage: 50, from, to });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { gte: from, lte: to } },
      }),
    );
  });
});
