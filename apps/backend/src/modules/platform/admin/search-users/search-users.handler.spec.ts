import { Test } from '@nestjs/testing';
import { SearchUsersHandler } from './search-users.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('SearchUsersHandler', () => {
  let handler: SearchUsersHandler;
  let findMany: jest.Mock;
  let count: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn();
    count = jest.fn();
    const prismaMock = {
      $allTenants: { user: { findMany, count } },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchUsersHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    handler = moduleRef.get(SearchUsersHandler);
  });

  it('searches across all tenants by email/name', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20, search: 'tariq' });

    const call = findMany.mock.calls[0][0] as { where: { OR: Array<Record<string, unknown>> } };
    expect(call.where.OR).toHaveLength(2);
    expect(call.where.OR[0]).toEqual({ email: { contains: 'tariq', mode: 'insensitive' } });
    expect(call.where.OR[1]).toEqual({ name: { contains: 'tariq', mode: 'insensitive' } });
  });

  it('filters by organizationId via memberships', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20, organizationId: 'o1' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { memberships: { some: { organizationId: 'o1' } } },
      }),
    );
  });

  it('combines search + organizationId filter', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20, search: 'tariq', organizationId: 'o1' });

    const call = findMany.mock.calls[0][0] as {
      where: { OR: unknown; memberships: unknown };
    };
    expect(call.where.OR).toBeDefined();
    expect(call.where.memberships).toBeDefined();
  });

  it('paginates correctly and returns totalPages', async () => {
    findMany.mockResolvedValue([{ id: 'u1' }]);
    count.mockResolvedValue(45);

    const result = await handler.execute({ page: 2, perPage: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    expect(result.meta).toEqual({ page: 2, perPage: 20, total: 45, totalPages: 3 });
  });
});
