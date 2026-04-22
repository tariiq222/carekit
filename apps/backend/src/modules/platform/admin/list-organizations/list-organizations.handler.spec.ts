import { Test } from '@nestjs/testing';
import { ListOrganizationsHandler } from './list-organizations.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('ListOrganizationsHandler', () => {
  let handler: ListOrganizationsHandler;
  let findMany: jest.Mock;
  let count: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn();
    count = jest.fn();
    const prismaMock = {
      $allTenants: { organization: { findMany, count } },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListOrganizationsHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    handler = moduleRef.get(ListOrganizationsHandler);
  });

  it('returns paginated orgs across all tenants', async () => {
    findMany.mockResolvedValue([
      { id: 'o1', slug: 'a', nameAr: 'A', suspendedAt: null },
      { id: 'o2', slug: 'b', nameAr: 'B', suspendedAt: new Date() },
    ]);
    count.mockResolvedValue(2);

    const result = await handler.execute({ page: 1, perPage: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20, orderBy: { createdAt: 'desc' } }),
    );
  });

  it('applies search filter on slug/nameAr/nameEn', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20, search: 'clinic' });

    const call = findMany.mock.calls[0][0] as { where: { OR: Array<Record<string, unknown>> } };
    expect(call.where.OR).toHaveLength(3);
    expect(call.where.OR[0]).toEqual({ slug: { contains: 'clinic', mode: 'insensitive' } });
  });

  it('filters suspended = true', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20, suspended: true });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { suspendedAt: { not: null } } }),
    );
  });

  it('filters suspended = false', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await handler.execute({ page: 1, perPage: 20, suspended: false });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { suspendedAt: null } }),
    );
  });

  it('computes totalPages = 0 when total = 0', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const result = await handler.execute({ page: 1, perPage: 20 });

    expect(result.meta.totalPages).toBe(0);
  });

  it('paginates with skip/take', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(45);

    const result = await handler.execute({ page: 3, perPage: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
    expect(result.meta.totalPages).toBe(3);
  });
});
