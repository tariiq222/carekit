import { Test } from '@nestjs/testing';
import { ListVerticalsAdminHandler } from './list-verticals-admin.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('ListVerticalsAdminHandler', () => {
  it('lists all verticals (active first) for admin audience', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'v1' }]);
    const prismaMock = { $allTenants: { vertical: { findMany } } } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListVerticalsAdminHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    const handler = moduleRef.get(ListVerticalsAdminHandler);

    await handler.execute();

    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
    });
  });
});
