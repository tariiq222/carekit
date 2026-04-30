import { Test } from '@nestjs/testing';
import { ListPlansAdminHandler } from './list-plans-admin.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('ListPlansAdminHandler', () => {
  it('lists plans across all tenants ordered by isActive then sortOrder', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    const prismaMock = { $allTenants: { plan: { findMany } } } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListPlansAdminHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    const handler = moduleRef.get(ListPlansAdminHandler);

    const result = await handler.execute();

    expect(result).toHaveLength(2);
    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
      include: { _count: { select: { subscriptions: true } } },
    });
  });
});
