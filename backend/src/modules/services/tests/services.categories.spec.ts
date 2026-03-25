/**
 * ServicesService — Category Tests
 * Covers: createCategory, findAllCategories, updateCategory, deleteCategory
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ServicesService } from '../services.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { CacheService } from '../../../common/services/cache.service.js';
import {
  createMockPrisma,
  createMockCache,
  mockCategory,
  mockCategory2,
} from './services.fixtures.js';

async function createModule(mockPrisma: ReturnType<typeof createMockPrisma>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ServicesService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: CacheService, useValue: createMockCache() },
    ],
  }).compile();
  return module.get<ServicesService>(ServicesService);
}

describe('ServicesService — createCategory', () => {
  let service: ServicesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should create a category with default sortOrder=0', async () => {
    const dto = { nameEn: 'New Category', nameAr: 'فئة جديدة' };
    mockPrisma.serviceCategory.create.mockResolvedValue({ ...mockCategory, ...dto, sortOrder: 0 });

    const result = await service.createCategory(dto);

    expect(result.nameEn).toBe(dto.nameEn);
    expect(mockPrisma.serviceCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nameEn: dto.nameEn, nameAr: dto.nameAr, sortOrder: 0 }) }),
    );
  });

  it('should create a category with explicit sortOrder', async () => {
    const dto = { nameEn: 'Priority Category', nameAr: 'فئة ذات أولوية', sortOrder: 5 };
    mockPrisma.serviceCategory.create.mockResolvedValue({ ...mockCategory, ...dto });

    await service.createCategory(dto);

    expect(mockPrisma.serviceCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sortOrder: 5 }) }),
    );
  });
});

describe('ServicesService — findAllCategories', () => {
  let service: ServicesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should return all active categories sorted by sortOrder', async () => {
    mockPrisma.serviceCategory.findMany.mockResolvedValue([mockCategory, mockCategory2]);

    const result = await service.findAllCategories();

    expect(result).toHaveLength(2);
    expect(mockPrisma.serviceCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    );
  });
});

describe('ServicesService — updateCategory', () => {
  let service: ServicesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should update category fields', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.serviceCategory.update.mockResolvedValue({ ...mockCategory, nameEn: 'Updated Category' });

    const result = await service.updateCategory(mockCategory.id, { nameEn: 'Updated Category' });

    expect(result.nameEn).toBe('Updated Category');
  });

  it('should allow deactivating a category', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.serviceCategory.update.mockResolvedValue({ ...mockCategory, isActive: false });

    const result = await service.updateCategory(mockCategory.id, { isActive: false });

    expect(result.isActive).toBe(false);
  });

  it('should throw NotFoundException if category not found', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(null);

    await expect(service.updateCategory('non-existent-id', { nameEn: 'Updated' })).rejects.toThrow(NotFoundException);
  });
});

describe('ServicesService — deleteCategory', () => {
  let service: ServicesService;
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

    await service.deleteCategory(mockCategory.id);

    expect(mockPrisma.serviceCategory.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockCategory.id } }),
    );
  });

  it('should throw ConflictException if category has assigned services', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.service.count.mockResolvedValue(3);

    await expect(service.deleteCategory(mockCategory.id)).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if category not found', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(null);

    await expect(service.deleteCategory('non-existent-id')).rejects.toThrow(NotFoundException);
  });
});
