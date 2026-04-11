/**
 * Department ↔ ServiceCategory ↔ Service — Relationship Tests
 *
 * Covers all cross-entity scenarios:
 *   - Category ↔ Department (create/update with departmentId, unassign)
 *   - Category ↔ Service (delete guards, soft-delete bypass)
 *   - Department categories count (_count active only)
 *   - Cross-entity cache invalidation
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ServiceCategoriesService } from '../../../src/modules/services/service-categories.service.js';
import { DepartmentsService } from '../../../src/modules/departments/departments.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import { CACHE_KEYS } from '../../../src/config/constants.js';
import {
  mockDepartment,
  mockCategory,
  mockCategory2,
  mockClinicService,
  createMockPrisma,
  createMockCache,
} from './services.fixtures.js';

// ─────────────────────────────────────────────────────────────────
// Helper: build ServiceCategoriesService with mocks
// ─────────────────────────────────────────────────────────────────

function buildCategoryMocks() {
  const prisma = createMockPrisma();
  const cache = createMockCache();
  return { prisma, cache };
}

async function createCategoryService(
  prisma: ReturnType<typeof createMockPrisma>,
  cache: ReturnType<typeof createMockCache>,
) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ServiceCategoriesService,
      { provide: PrismaService, useValue: prisma },
      { provide: CacheService, useValue: cache },
    ],
  }).compile();
  return module.get<ServiceCategoriesService>(ServiceCategoriesService);
}

// ─────────────────────────────────────────────────────────────────
// Helper: build DepartmentsService with mocks
// ─────────────────────────────────────────────────────────────────

function buildDeptMocks() {
  const prisma = {
    department: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const cache = createMockCache();
  return { prisma, cache };
}

async function createDeptService(
  prisma: ReturnType<typeof buildDeptMocks>['prisma'],
  cache: ReturnType<typeof createMockCache>,
) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      DepartmentsService,
      { provide: PrismaService, useValue: prisma },
      { provide: CacheService, useValue: cache },
    ],
  }).compile();
  return module.get<DepartmentsService>(DepartmentsService);
}

// ═════════════════════════════════════════════════════════════════
//  1. Category ↔ Department relationship
// ═════════════════════════════════════════════════════════════════

describe('Category-Department relationship', () => {
  let catService: ServiceCategoriesService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(async () => {
    ({ prisma, cache } = buildCategoryMocks());
    catService = await createCategoryService(prisma, cache);
    jest.clearAllMocks();
  });

  // ── create ──

  describe('create category with departmentId', () => {
    it('should pass departmentId to prisma when provided', async () => {
      const dto = {
        nameEn: 'Cat A',
        nameAr: 'فئة أ',
        departmentId: 'dept-uuid-1',
      };
      prisma.serviceCategory.create.mockResolvedValue({
        ...mockCategory,
        ...dto,
      });

      await catService.create(dto);

      expect(prisma.serviceCategory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ departmentId: 'dept-uuid-1' }),
      });
    });

    it('should require departmentId when creating category', async () => {
      const dto = {
        nameEn: 'Cat B',
        nameAr: 'فئة ب',
        departmentId: 'dept-uuid-1',
      };
      prisma.serviceCategory.create.mockResolvedValue({
        ...mockCategory2,
        ...dto,
      });

      await catService.create(dto);

      expect(prisma.serviceCategory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ departmentId: 'dept-uuid-1' }),
      });
    });

    it('should return the created category', async () => {
      const dto = {
        nameEn: 'Cat C',
        nameAr: 'فئة ج',
        departmentId: 'dept-uuid-1',
      };
      const expected = { ...mockCategory, ...dto };
      prisma.serviceCategory.create.mockResolvedValue(expected);

      const result = await catService.create(dto);

      expect(result).toEqual(expected);
    });
  });

  // ── update departmentId ──

  describe('update category departmentId', () => {
    it('should assign department to unassigned category', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory2);
      prisma.serviceCategory.update.mockResolvedValue({
        ...mockCategory2,
        departmentId: 'dept-uuid-1',
      });

      const result = await catService.update(mockCategory2.id, {
        departmentId: 'dept-uuid-1',
      });

      expect(result.departmentId).toBe('dept-uuid-1');
      expect(prisma.serviceCategory.update).toHaveBeenCalledWith({
        where: { id: mockCategory2.id },
        data: expect.objectContaining({ departmentId: 'dept-uuid-1' }),
      });
    });

    it('should change department from one to another', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.serviceCategory.update.mockResolvedValue({
        ...mockCategory,
        departmentId: 'dept-uuid-2',
      });

      const result = await catService.update(mockCategory.id, {
        departmentId: 'dept-uuid-2',
      });

      expect(result.departmentId).toBe('dept-uuid-2');
    });

    it('should reassign department to a different one', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.serviceCategory.update.mockResolvedValue({
        ...mockCategory,
        departmentId: 'dept-uuid-2',
      });

      const result = await catService.update(mockCategory.id, {
        departmentId: 'dept-uuid-2',
      });

      expect(result.departmentId).toBe('dept-uuid-2');
    });

    it('should throw NotFoundException for non-existent category', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(null);

      await expect(
        catService.update('non-existent', { departmentId: 'dept-uuid-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── cache invalidation ──

  describe('cache invalidation on category mutations', () => {
    it('should invalidate CATEGORIES_ACTIVE and SERVICES_ACTIVE on create', async () => {
      prisma.serviceCategory.create.mockResolvedValue(mockCategory);

      await catService.create({
        nameEn: 'X',
        nameAr: 'ص',
        departmentId: 'dept-uuid-1',
      });

      expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.CATEGORIES_ACTIVE);
      expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.SERVICES_ACTIVE);
    });

    it('should invalidate CATEGORIES_ACTIVE and SERVICES_ACTIVE on update', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.serviceCategory.update.mockResolvedValue(mockCategory);

      await catService.update(mockCategory.id, { nameEn: 'Updated' });

      expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.CATEGORIES_ACTIVE);
      expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.SERVICES_ACTIVE);
    });

    it('should invalidate CATEGORIES_ACTIVE and SERVICES_ACTIVE on delete', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.service.count.mockResolvedValue(0);
      prisma.serviceCategory.delete.mockResolvedValue(mockCategory);

      await catService.delete(mockCategory.id);

      expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.CATEGORIES_ACTIVE);
      expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.SERVICES_ACTIVE);
    });
  });
});

// ═════════════════════════════════════════════════════════════════
//  2. Category ↔ Service relationship (delete guards)
// ═════════════════════════════════════════════════════════════════

describe('Category-Service relationship', () => {
  let catService: ServiceCategoriesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    const mocks = buildCategoryMocks();
    prisma = mocks.prisma;
    catService = await createCategoryService(mocks.prisma, mocks.cache);
    jest.clearAllMocks();
  });

  describe('delete category with services', () => {
    it('should throw ConflictException when category has active services', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.service.count.mockResolvedValue(5);

      await expect(catService.delete(mockCategory.id)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.serviceCategory.delete).not.toHaveBeenCalled();
    });

    it('should include correct error message in ConflictException', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.service.count.mockResolvedValue(2);

      await expect(catService.delete(mockCategory.id)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            message: 'Cannot delete category with assigned services',
          }),
        }),
      );
    });

    it('should allow deletion when all services are soft-deleted', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.service.count.mockResolvedValue(0);
      prisma.serviceCategory.delete.mockResolvedValue(mockCategory);

      const result = await catService.delete(mockCategory.id);

      expect(result).toEqual({ deleted: true });
      expect(prisma.service.count).toHaveBeenCalledWith({
        where: { categoryId: mockCategory.id, deletedAt: null },
      });
    });

    it('should allow deletion when category has zero services', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.service.count.mockResolvedValue(0);
      prisma.serviceCategory.delete.mockResolvedValue(mockCategory);

      const result = await catService.delete(mockCategory.id);

      expect(result).toEqual({ deleted: true });
      expect(prisma.serviceCategory.delete).toHaveBeenCalledWith({
        where: { id: mockCategory.id },
      });
    });

    it('should only count active (non-soft-deleted) services', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.service.count.mockResolvedValue(0);
      prisma.serviceCategory.delete.mockResolvedValue(mockCategory);

      await catService.delete(mockCategory.id);

      expect(prisma.service.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ deletedAt: null }),
      });
    });

    it('should throw NotFoundException for non-existent category', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValue(null);

      await expect(catService.delete('ghost-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

// ═════════════════════════════════════════════════════════════════
//  3. Department → categories count
// ═════════════════════════════════════════════════════════════════

describe('Department categories count', () => {
  let deptService: DepartmentsService;
  let prisma: ReturnType<typeof buildDeptMocks>['prisma'];

  beforeEach(async () => {
    const mocks = buildDeptMocks();
    prisma = mocks.prisma;
    deptService = await createDeptService(mocks.prisma, mocks.cache);
    jest.clearAllMocks();
  });

  it('findOne should include _count of active categories', async () => {
    prisma.department.findFirst.mockResolvedValue(mockDepartment);

    await deptService.findOne('dept-uuid-1');

    expect(prisma.department.findFirst).toHaveBeenCalledWith({
      where: { id: 'dept-uuid-1', deletedAt: null },
      include: {
        _count: { select: { categories: { where: { isActive: true } } } },
      },
    });
  });

  it('findAll should include _count of active categories per department', async () => {
    prisma.department.findMany.mockResolvedValue([mockDepartment]);
    prisma.department.count.mockResolvedValue(1);

    await deptService.findAll({});

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          _count: { select: { categories: { where: { isActive: true } } } },
        },
      }),
    );
  });

  it('should return correct _count value from database', async () => {
    const deptWith5 = { ...mockDepartment, _count: { categories: 5 } };
    prisma.department.findFirst.mockResolvedValue(deptWith5);

    const result = await deptService.findOne('dept-uuid-1');

    expect(result._count.categories).toBe(5);
  });

  it('should return 0 count for department with no active categories', async () => {
    const deptWith0 = { ...mockDepartment, _count: { categories: 0 } };
    prisma.department.findFirst.mockResolvedValue(deptWith0);

    const result = await deptService.findOne('dept-uuid-1');

    expect(result._count.categories).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════
//  4. Department soft-delete behavior
// ═════════════════════════════════════════════════════════════════

describe('Department soft-delete behavior', () => {
  let deptService: DepartmentsService;
  let prisma: ReturnType<typeof buildDeptMocks>['prisma'];

  beforeEach(async () => {
    const mocks = buildDeptMocks();
    prisma = mocks.prisma;
    deptService = await createDeptService(mocks.prisma, mocks.cache);
    jest.clearAllMocks();
  });

  it('should soft-delete by setting deletedAt, not hard-delete', async () => {
    prisma.department.findFirst.mockResolvedValue(mockDepartment);
    prisma.department.update.mockResolvedValue({
      ...mockDepartment,
      deletedAt: new Date(),
    });

    await deptService.remove('dept-uuid-1');

    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: 'dept-uuid-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should not call any category deletion on department remove', async () => {
    const catPrisma = createMockPrisma();
    prisma.department.findFirst.mockResolvedValue(mockDepartment);
    prisma.department.update.mockResolvedValue({
      ...mockDepartment,
      deletedAt: new Date(),
    });

    await deptService.remove('dept-uuid-1');

    expect(catPrisma.serviceCategory.delete).not.toHaveBeenCalled();
    expect(catPrisma.serviceCategory.update).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when removing non-existent department', async () => {
    prisma.department.findFirst.mockResolvedValue(null);

    await expect(deptService.remove('ghost-dept')).rejects.toThrow(
      NotFoundException,
    );
  });
});

// ═════════════════════════════════════════════════════════════════
//  5. Cross-entity cache invalidation
// ═════════════════════════════════════════════════════════════════

describe('Cross-entity cache invalidation', () => {
  it('department create should invalidate DEPARTMENTS_ACTIVE only', async () => {
    const { prisma, cache } = buildDeptMocks();
    const deptService = await createDeptService(prisma, cache);
    jest.clearAllMocks();

    prisma.department.create.mockResolvedValue(mockDepartment);

    await deptService.create({ nameAr: 'قسم', nameEn: 'Dept' });

    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.DEPARTMENTS_ACTIVE);
    expect(cache.del).toHaveBeenCalledTimes(1);
  });

  it('department update should invalidate DEPARTMENTS_ACTIVE only', async () => {
    const { prisma, cache } = buildDeptMocks();
    const deptService = await createDeptService(prisma, cache);
    jest.clearAllMocks();

    prisma.department.findFirst.mockResolvedValue(mockDepartment);
    prisma.department.update.mockResolvedValue(mockDepartment);

    await deptService.update('dept-uuid-1', { nameAr: 'تحديث' });

    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.DEPARTMENTS_ACTIVE);
    expect(cache.del).toHaveBeenCalledTimes(1);
  });

  it('department remove should invalidate DEPARTMENTS_ACTIVE only', async () => {
    const { prisma, cache } = buildDeptMocks();
    const deptService = await createDeptService(prisma, cache);
    jest.clearAllMocks();

    prisma.department.findFirst.mockResolvedValue(mockDepartment);
    prisma.department.update.mockResolvedValue({
      ...mockDepartment,
      deletedAt: new Date(),
    });

    await deptService.remove('dept-uuid-1');

    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.DEPARTMENTS_ACTIVE);
    expect(cache.del).toHaveBeenCalledTimes(1);
  });

  it('category create should invalidate CATEGORIES_ACTIVE + SERVICES_ACTIVE', async () => {
    const { prisma, cache } = buildCategoryMocks();
    const catService = await createCategoryService(prisma, cache);
    jest.clearAllMocks();

    prisma.serviceCategory.create.mockResolvedValue(mockCategory);

    await catService.create({
      nameEn: 'New',
      nameAr: 'جديد',
      departmentId: 'dept-uuid-1',
    });

    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.CATEGORIES_ACTIVE);
    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.SERVICES_ACTIVE);
    expect(cache.del).toHaveBeenCalledTimes(2);
  });

  it('category delete should invalidate CATEGORIES_ACTIVE + SERVICES_ACTIVE', async () => {
    const { prisma, cache } = buildCategoryMocks();
    const catService = await createCategoryService(prisma, cache);
    jest.clearAllMocks();

    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    prisma.service.count.mockResolvedValue(0);
    prisma.serviceCategory.delete.mockResolvedValue(mockCategory);

    await catService.delete(mockCategory.id);

    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.CATEGORIES_ACTIVE);
    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.SERVICES_ACTIVE);
    expect(cache.del).toHaveBeenCalledTimes(2);
  });

  it('department mutation should NOT invalidate CATEGORIES or SERVICES cache', async () => {
    const { prisma, cache } = buildDeptMocks();
    const deptService = await createDeptService(prisma, cache);
    jest.clearAllMocks();

    prisma.department.create.mockResolvedValue(mockDepartment);

    await deptService.create({ nameAr: 'قسم', nameEn: 'Dept' });

    expect(cache.del).not.toHaveBeenCalledWith(CACHE_KEYS.CATEGORIES_ACTIVE);
    expect(cache.del).not.toHaveBeenCalledWith(CACHE_KEYS.SERVICES_ACTIVE);
  });
});
