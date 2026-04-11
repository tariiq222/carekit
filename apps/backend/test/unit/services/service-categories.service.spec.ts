/**
 * ServiceCategoriesService — Unit Tests
 * Covers: create, findAll (cache hit/miss), update, delete
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ServiceCategoriesService } from '../../../src/modules/services/service-categories.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import {
  createMockPrisma,
  createMockCache,
  mockCategory,
} from './services.fixtures.js';

async function createModule(
  mockPrisma: ReturnType<typeof createMockPrisma>,
  mockCache: ReturnType<typeof createMockCache>,
) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ServiceCategoriesService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: CacheService, useValue: mockCache },
    ],
  }).compile();
  return module.get<ServiceCategoriesService>(ServiceCategoriesService);
}

describe('ServiceCategoriesService — create', () => {
  let service: ServiceCategoriesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockCache: ReturnType<typeof createMockCache>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockCache = createMockCache();
    service = await createModule(mockPrisma, mockCache);
    jest.clearAllMocks();
  });

  it('should create a category and invalidate cache', async () => {
    mockPrisma.serviceCategory.create.mockResolvedValue(mockCategory);

    const result = await service.create({
      nameEn: mockCategory.nameEn,
      nameAr: mockCategory.nameAr,
      sortOrder: mockCategory.sortOrder,
      departmentId: mockCategory.departmentId,
    });

    expect(result.id).toBe(mockCategory.id);
    expect(mockPrisma.serviceCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nameEn: mockCategory.nameEn,
          nameAr: mockCategory.nameAr,
        }),
      }),
    );
    expect(mockCache.del).toHaveBeenCalledWith('cache:categories:active');
    expect(mockCache.del).toHaveBeenCalledWith('cache:services:active');
  });

  it('should default sortOrder to 0 when not provided', async () => {
    mockPrisma.serviceCategory.create.mockResolvedValue({
      ...mockCategory,
      sortOrder: 0,
    });

    await service.create({
      nameEn: 'New',
      nameAr: 'جديد',
      departmentId: 'dept-uuid-1',
    });

    expect(mockPrisma.serviceCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sortOrder: 0 }),
      }),
    );
  });
});

describe('ServiceCategoriesService — findAll', () => {
  let service: ServiceCategoriesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockCache: ReturnType<typeof createMockCache>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockCache = createMockCache();
    service = await createModule(mockPrisma, mockCache);
    jest.clearAllMocks();
  });

  it('should return cached data without hitting the DB', async () => {
    const cached = [mockCategory];
    mockCache.get.mockResolvedValue(cached);

    const result = await service.findAll();

    expect(result).toBe(cached);
    expect(mockPrisma.serviceCategory.findMany).not.toHaveBeenCalled();
    expect(mockCache.set).not.toHaveBeenCalled();
  });

  it('should fetch from DB and populate cache when cache is empty', async () => {
    mockCache.get.mockResolvedValue(null);
    mockPrisma.serviceCategory.findMany.mockResolvedValue([mockCategory]);

    const result = await service.findAll();

    expect(result).toEqual([mockCategory]);
    expect(mockPrisma.serviceCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(mockCache.set).toHaveBeenCalledWith(
      'cache:categories:active',
      [mockCategory],
      expect.any(Number),
    );
  });
});

describe('ServiceCategoriesService — update', () => {
  let service: ServiceCategoriesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockCache: ReturnType<typeof createMockCache>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockCache = createMockCache();
    service = await createModule(mockPrisma, mockCache);
    jest.clearAllMocks();
  });

  it('should throw NotFoundException when category does not exist', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(null);

    await expect(
      service.update('non-existent-id', { nameEn: 'Updated' }),
    ).rejects.toThrow(NotFoundException);

    expect(mockPrisma.serviceCategory.update).not.toHaveBeenCalled();
  });

  it('should update category and invalidate cache on success', async () => {
    const updated = { ...mockCategory, nameEn: 'Updated General Medicine' };
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.serviceCategory.update.mockResolvedValue(updated);

    const result = await service.update(mockCategory.id, {
      nameEn: 'Updated General Medicine',
    });

    expect(result.nameEn).toBe('Updated General Medicine');
    expect(mockPrisma.serviceCategory.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockCategory.id } }),
    );
    expect(mockCache.del).toHaveBeenCalledWith('cache:categories:active');
    expect(mockCache.del).toHaveBeenCalledWith('cache:services:active');
  });
});

describe('ServiceCategoriesService — delete', () => {
  let service: ServiceCategoriesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockCache: ReturnType<typeof createMockCache>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockCache = createMockCache();
    service = await createModule(mockPrisma, mockCache);
    jest.clearAllMocks();
  });

  it('should throw NotFoundException when category does not exist', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(null);

    await expect(service.delete('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );

    expect(mockPrisma.service.count).not.toHaveBeenCalled();
    expect(mockPrisma.serviceCategory.delete).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when category has active services', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.service.count.mockResolvedValue(3);

    await expect(service.delete(mockCategory.id)).rejects.toThrow(
      ConflictException,
    );

    expect(mockPrisma.serviceCategory.delete).not.toHaveBeenCalled();
  });

  it('should delete category and invalidate cache when no active services', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.service.count.mockResolvedValue(0);
    mockPrisma.serviceCategory.delete.mockResolvedValue(mockCategory);

    const result = await service.delete(mockCategory.id);

    expect(result).toEqual({ deleted: true });
    expect(mockPrisma.serviceCategory.delete).toHaveBeenCalledWith({
      where: { id: mockCategory.id },
    });
    expect(mockCache.del).toHaveBeenCalledWith('cache:categories:active');
    expect(mockCache.del).toHaveBeenCalledWith('cache:services:active');
  });
});
