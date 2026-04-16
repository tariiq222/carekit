import { NotFoundException } from '@nestjs/common';
import { CreateCategoryHandler } from './create-category.handler';
import { ListCategoriesHandler } from './list-categories.handler';
import { UpdateCategoryHandler } from './update-category.handler';

const mockCategory = { id: 'cat-1', nameAr: 'فحص', nameEn: 'Checkup', sortOrder: 0, isActive: true, departmentId: null };

const buildPrisma = () => ({
  serviceCategory: {
    create: jest.fn().mockResolvedValue(mockCategory),
    findMany: jest.fn().mockResolvedValue([mockCategory]),
    count: jest.fn().mockResolvedValue(1),
    findFirst: jest.fn().mockResolvedValue(mockCategory),
    update: jest.fn().mockResolvedValue(mockCategory),
  },
  $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises as unknown as unknown[])),
});

describe('CreateCategoryHandler', () => {
  it('creates a category', async () => {
    const prisma = buildPrisma();
    const handler = new CreateCategoryHandler(prisma as never);
    const result = await handler.execute({ nameAr: 'فحص', nameEn: 'Checkup' });
    expect(prisma.serviceCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nameAr: 'فحص' }) }),
    );
    expect(result).toMatchObject({ id: 'cat-1' });
  });
});

describe('ListCategoriesHandler', () => {
  it('returns categories', async () => {
    const prisma = buildPrisma();
    const handler = new ListCategoriesHandler(prisma as never);
    const result = await handler.execute({ page: 1, limit: 10 });
    expect(prisma.serviceCategory.findMany).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
  });
});

describe('UpdateCategoryHandler', () => {
  it('updates category fields', async () => {
    const prisma = buildPrisma();
    const handler = new UpdateCategoryHandler(prisma as never);
    await handler.execute({ categoryId: 'cat-1', nameEn: 'Updated' });
    expect(prisma.serviceCategory.update).toHaveBeenCalled();
  });

  it('throws NotFoundException when category not found', async () => {
    const prisma = buildPrisma();
    prisma.serviceCategory.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new UpdateCategoryHandler(prisma as never);
    await expect(handler.execute({ categoryId: 'bad', nameEn: 'x' })).rejects.toThrow(NotFoundException);
  });
});
