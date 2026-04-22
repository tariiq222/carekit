import { Test } from '@nestjs/testing';
import { ListVerticalsHandler } from './list-verticals.handler';
import { PrismaService } from '../../../infrastructure/database';

const mockVertical = {
  id: 'v1',
  slug: 'medical',
  nameAr: 'طبي',
  nameEn: 'Medical',
  templateFamily: 'MEDICAL' as const,
  descriptionAr: null,
  descriptionEn: null,
  iconUrl: null,
  sortOrder: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  seedDepartments: [],
  seedServiceCategories: [],
  terminologyOverrides: [],
};

const mockInactiveVertical = {
  ...mockVertical,
  id: 'v2',
  slug: 'inactive-vertical',
  isActive: false,
  sortOrder: 0,
};

describe('ListVerticalsHandler', () => {
  let handler: ListVerticalsHandler;
  let prisma: { vertical: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      vertical: { findMany: jest.fn().mockResolvedValue([mockVertical]) },
    };
    const module = await Test.createTestingModule({
      providers: [
        ListVerticalsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(ListVerticalsHandler);
  });

  it('delegates to prisma.vertical.findMany with correct args', async () => {
    await handler.execute();
    expect(prisma.vertical.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('returns only isActive=true verticals', async () => {
    const result = await handler.execute();
    expect(result).toHaveLength(1);
    expect(result[0].isActive).toBe(true);
  });

  it('returns verticals ordered by sortOrder asc', async () => {
    const ordered = [
      { ...mockVertical, id: 'v1', sortOrder: 1 },
      { ...mockVertical, id: 'v2', slug: 'consulting', sortOrder: 2 },
    ];
    prisma.vertical.findMany.mockResolvedValue(ordered);
    const result = await handler.execute();
    expect(result[0].sortOrder).toBeLessThan(result[1].sortOrder);
  });

  it('returns empty array when no active verticals exist', async () => {
    prisma.vertical.findMany.mockResolvedValue([]);
    const result = await handler.execute();
    expect(result).toEqual([]);
  });
});
