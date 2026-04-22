import { Test } from '@nestjs/testing';
import { ListImpersonationSessionsHandler } from './list-impersonation-sessions.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('ListImpersonationSessionsHandler', () => {
  let handler: ListImpersonationSessionsHandler;
  let findMany: jest.Mock;
  let count: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn();
    count = jest.fn();
    const prismaMock = {
      $allTenants: { impersonationSession: { findMany, count } },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListImpersonationSessionsHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    handler = moduleRef.get(ListImpersonationSessionsHandler);
  });

  it('lists all sessions with pagination', async () => {
    findMany.mockResolvedValue([{ id: 's1' }]);
    count.mockResolvedValue(1);

    const result = await handler.execute({ page: 1, perPage: 50 });

    expect(result.items).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { startedAt: 'desc' } }),
    );
  });

  it('filters active = true (endedAt null + expiresAt > now)', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 50, active: true });

    const where = (findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where.endedAt).toBeNull();
    expect(where.expiresAt).toEqual({ gt: expect.any(Date) });
  });

  it('filters active = false (ended or expired)', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 50, active: false });

    const where = (findMany.mock.calls[0][0] as { where: { OR: unknown[] } }).where;
    expect(where.OR).toHaveLength(2);
  });
});
