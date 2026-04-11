/**
 * ServiceCategoriesService — Category Tests
 * Covers: create, findAll, update, delete
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ServiceCategoriesService } from '../../../src/modules/services/service-categories.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import {
  createMockPrisma,
  createMockCache,
  mockCategory,
  mockCategory2,
} from './services.fixtures.js';

async function createModule(mockPrisma: ReturnType<typeof createMockPrisma>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ServiceCategoriesService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: CacheService, useValue: createMockCache() },
    ],
  }).compile();
  return module.get<ServiceCategoriesService>(ServiceCategoriesService);
}

describe('ServiceCategoriesService — create', () => {
  let service: ServiceCategoriesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should create a category with default sortOrder=0', async () => {
    const dto = {
      nameEn: 'New Category',
      nameAr: 'فئة جديدة',
      departmentId: 'dept-uuid-1',
    };
    mockPrisma.serviceCategory.create.mockResolvedValue({
      ...mockCategory,
      ...dto,
      sortOrder: 0,
    });

    const result = await service.create(dto);

    expect(result.nameEn).toBe(dto.nameEn);
    expect(mockPrisma.serviceCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nameEn: dto.nameEn,
          nameAr: dto.nameAr,
          sortOrder: 0,
        }),
      }),
    );
  });

  it('should create a category with explicit sortOrder', async () => {
    const dto = {
      nameEn: 'Priority Category',
      nameAr: 'فئة ذات أولوية',
      sortOrder: 5,
      departmentId: 'dept-uuid-1',
    };
    mockPrisma.serviceCategory.create.mockResolvedValue({
      ...mockCategory,
      ...dto,
    });

    await service.create(dto);

    expect(mockPrisma.serviceCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sortOrder: 5 }),
      }),
    );
  });
});

describe('ServiceCategoriesService — findAll', () => {
  let service: ServiceCategoriesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should return all active categories sorted by sortOrder', async () => {
    mockPrisma.serviceCategory.findMany.mockResolvedValue([
      mockCategory,
      mockCategory2,
    ]);

    const result = await service.findAll();

    expect(result).toHaveLength(2);
    expect(mockPrisma.serviceCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  });
});

describe('ServiceCategoriesService — update', () => {
  let service: ServiceCategoriesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should update category fields', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.serviceCategory.update.mockResolvedValue({
      ...mockCategory,
      nameEn: 'Updated Category',
    });

    const result = await service.update(mockCategory.id, {
      nameEn: 'Updated Category',
    });

    expect(result.nameEn).toBe('Updated Category');
  });

  it('should allow deactivating a category', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.serviceCategory.update.mockResolvedValue({
      ...mockCategory,
      isActive: false,
    });

    const result = await service.update(mockCategory.id, { isActive: false });

    expect(result.isActive).toBe(false);
  });

  it('should throw NotFoundException if category not found', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(null);

    await expect(
      service.update('non-existent-id', { nameEn: 'Updated' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ServiceCategoriesService — delete', () => {
  let service: ServiceCategoriesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should delete a category with no services', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.service.count.mockResolvedValue(0);
    mockPrisma.serviceCategory.delete.mockResolvedValue(mockCategory);

    await service.delete(mockCategory.id);

    expect(mockPrisma.serviceCategory.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockCategory.id } }),
    );
  });

  it('should throw ConflictException if category has assigned services', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.service.count.mockResolvedValue(3);

    await expect(service.delete(mockCategory.id)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should allow deleting a category whose services are all soft-deleted', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    // All services are soft-deleted — count of ACTIVE services = 0
    mockPrisma.service.count.mockResolvedValue(0);
    mockPrisma.serviceCategory.delete.mockResolvedValue(mockCategory);

    const result = await service.delete(mockCategory.id);

    expect(result).toEqual({ deleted: true });
    // Verify the count query excludes soft-deleted services
    expect(mockPrisma.service.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categoryId: mockCategory.id,
          deletedAt: null,
        }),
      }),
    );
  });

  it('should throw NotFoundException if category not found', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(null);

    await expect(service.delete('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
