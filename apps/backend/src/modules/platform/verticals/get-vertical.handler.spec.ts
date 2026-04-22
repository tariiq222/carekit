import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetVerticalHandler } from './get-vertical.handler';
import { PrismaService } from '../../../infrastructure/database';

const mockDepartment = {
  id: 'd1',
  verticalId: 'v1',
  nameAr: 'قسم',
  nameEn: 'Department',
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockServiceCategory = {
  id: 'sc1',
  verticalId: 'v1',
  departmentId: null,
  nameAr: 'فئة',
  nameEn: 'Category',
  sortOrder: 1,
};

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
  seedDepartments: [mockDepartment],
  seedServiceCategories: [mockServiceCategory],
  terminologyOverrides: [],
};

describe('GetVerticalHandler', () => {
  let handler: GetVerticalHandler;
  let prisma: { vertical: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      vertical: { findFirst: jest.fn().mockResolvedValue(mockVertical) },
    };
    const module = await Test.createTestingModule({
      providers: [
        GetVerticalHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(GetVerticalHandler);
  });

  it('returns vertical with seedDepartments and seedServiceCategories on success', async () => {
    const result = await handler.execute({ slug: 'medical' });
    expect(result).toEqual(mockVertical);
    expect(result.seedDepartments).toHaveLength(1);
    expect(result.seedServiceCategories).toHaveLength(1);
  });

  it('calls prisma with slug and isActive=true filter and correct includes', async () => {
    await handler.execute({ slug: 'medical' });
    expect(prisma.vertical.findFirst).toHaveBeenCalledWith({
      where: { slug: 'medical', isActive: true },
      include: {
        seedDepartments: { orderBy: { sortOrder: 'asc' } },
        seedServiceCategories: { orderBy: { sortOrder: 'asc' } },
      },
    });
  });

  it('throws NotFoundException when prisma returns null (not found)', async () => {
    prisma.vertical.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ slug: 'unknown' })).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when vertical is inactive (isActive filter returns null)', async () => {
    prisma.vertical.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ slug: 'inactive-vertical' })).rejects.toThrow(
      "Vertical 'inactive-vertical' not found",
    );
  });
});
