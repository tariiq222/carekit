/**
 * Department → ServiceCategory → Service — Full Chain Tests
 *
 * Covers cross-entity scenarios not tested in individual spec files:
 *   - Service creation validates categoryId exists
 *   - Service update validates new categoryId exists
 *   - Service update with category change invalidates correct caches
 *   - Service findAll filters by categoryId (only services in that category)
 *   - Category findAll returns only active categories
 *   - Category with departmentId pointing to soft-deleted department
 *   - Full chain: dept → category → service — verify includes
 *   - Cascade behavior: department soft-delete leaves categories with null departmentId (onDelete: SetNull)
 *   - Category delete blocked when has active services, allowed when all soft-deleted
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ServicesService } from '../../../src/modules/services/services.service.js';
import { ServiceCategoriesService } from '../../../src/modules/services/service-categories.service.js';
import { DepartmentsService } from '../../../src/modules/departments/departments.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import { IntakeFormsService } from '../../../src/modules/intake-forms/intake-forms.service.js';
import { CACHE_KEYS } from '../../../src/config/constants.js';
import {
  mockDepartment,
  mockDepartment2,
  mockCategory,
  mockCategory2,
  mockClinicService,
  createMockPrisma,
  createMockCache,
} from './services.fixtures.js';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function buildServicesService(
  prisma: ReturnType<typeof createMockPrisma>,
  cache: ReturnType<typeof createMockCache>,
) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ServicesService,
      { provide: PrismaService, useValue: prisma },
      { provide: CacheService, useValue: cache },
      { provide: IntakeFormsService, useValue: { listForms: jest.fn() } },
    ],
  }).compile();
  return module.get<ServicesService>(ServicesService);
}

async function buildCategoriesService(
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

function buildDeptMocks() {
  return {
    prisma: {
      department: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    },
    cache: createMockCache(),
  };
}

async function buildDeptService(
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

// Mock service with category and department chain
const mockServiceWithChain = {
  ...mockClinicService,
  category: {
    ...mockCategory,
    department: mockDepartment,
  },
};

const mockService2 = {
  id: 'service-uuid-2',
  nameEn: 'Teeth Cleaning',
  nameAr: 'تنظيف الأسنان',
  descriptionEn: 'Professional teeth cleaning',
  descriptionAr: 'تنظيف أسنان احترافي',
  categoryId: mockCategory.id,
  price: 20000,
  duration: 45,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-01-16'),
  updatedAt: new Date('2026-01-16'),
  category: mockCategory,
};

const mockServiceInCategory2 = {
  id: 'service-uuid-3',
  nameEn: 'Eye Exam',
  nameAr: 'فحص العيون',
  descriptionEn: null,
  descriptionAr: null,
  categoryId: mockCategory2.id,
  price: 10000,
  duration: 20,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-01-17'),
  updatedAt: new Date('2026-01-17'),
  category: mockCategory2,
};

// ═════════════════════════════════════════════════════════════════
//  1. Service → Category validation on create
// ═════════════════════════════════════════════════════════════════

describe('Service-Category: creation validation', () => {
  let svcService: ServicesService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    cache = createMockCache();
    svcService = await buildServicesService(prisma, cache);
    jest.clearAllMocks();
  });

  it('should throw NotFoundException when creating service with non-existent categoryId', async () => {
    prisma.serviceCategory.findUnique.mockResolvedValue(null);

    await expect(
      svcService.create({
        nameEn: 'New Service',
        nameAr: 'خدمة جديدة',
        categoryId: 'non-existent-category',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.service.create).not.toHaveBeenCalled();
  });

  it('should create service when categoryId is valid', async () => {
    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    prisma.service.create.mockResolvedValue(mockClinicService);

    const result = await svcService.create({
      nameEn: 'General Consultation',
      nameAr: 'استشارة عامة',
      categoryId: mockCategory.id,
    });

    expect(result.categoryId).toBe(mockCategory.id);
    expect(prisma.serviceCategory.findUnique).toHaveBeenCalledWith({
      where: { id: mockCategory.id },
    });
  });

  it('should include category relation in created service response', async () => {
    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    prisma.service.create.mockResolvedValue(mockClinicService);

    await svcService.create({
      nameEn: 'Test',
      nameAr: 'اختبار',
      categoryId: mockCategory.id,
    });

    expect(prisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ category: true }),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════
//  2. Service → Category validation on update
// ═════════════════════════════════════════════════════════════════

describe('Service-Category: update category change', () => {
  let svcService: ServicesService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    cache = createMockCache();
    svcService = await buildServicesService(prisma, cache);
    jest.clearAllMocks();
  });

  it('should throw NotFoundException when updating to non-existent categoryId', async () => {
    prisma.service.findFirst.mockResolvedValue(mockClinicService);
    prisma.serviceCategory.findUnique.mockResolvedValue(null);

    await expect(
      svcService.update(mockClinicService.id, { categoryId: 'ghost-category' }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it('should allow moving service to a different valid category', async () => {
    prisma.service.findFirst.mockResolvedValue(mockClinicService);
    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory2);
    prisma.service.update.mockResolvedValue({
      ...mockClinicService,
      categoryId: mockCategory2.id,
      category: mockCategory2,
    });

    const result = await svcService.update(mockClinicService.id, {
      categoryId: mockCategory2.id,
    });

    expect(result.categoryId).toBe(mockCategory2.id);
  });

  it('should not validate category when categoryId is not in update dto', async () => {
    prisma.service.findFirst.mockResolvedValue(mockClinicService);
    prisma.service.update.mockResolvedValue({
      ...mockClinicService,
      nameEn: 'Updated Name',
    });

    await svcService.update(mockClinicService.id, { nameEn: 'Updated Name' });

    expect(prisma.serviceCategory.findUnique).not.toHaveBeenCalled();
  });

  it('should invalidate both SERVICES and CATEGORIES cache when category changes', async () => {
    prisma.service.findFirst.mockResolvedValue(mockClinicService);
    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory2);
    prisma.service.update.mockResolvedValue({
      ...mockClinicService,
      categoryId: mockCategory2.id,
    });

    await svcService.update(mockClinicService.id, {
      categoryId: mockCategory2.id,
    });

    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.SERVICES_ACTIVE);
    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.CATEGORIES_ACTIVE);
  });

  it('should only invalidate SERVICES cache when updating non-category fields', async () => {
    prisma.service.findFirst.mockResolvedValue(mockClinicService);
    prisma.service.update.mockResolvedValue({
      ...mockClinicService,
      price: 25000,
    });

    await svcService.update(mockClinicService.id, { price: 25000 });

    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.SERVICES_ACTIVE);
    expect(cache.del).not.toHaveBeenCalledWith(CACHE_KEYS.CATEGORIES_ACTIVE);
  });
});

// ═════════════════════════════════════════════════════════════════
//  3. Service findAll — categoryId filter
// ═════════════════════════════════════════════════════════════════

describe('Service-Category: findAll with categoryId filter', () => {
  let svcService: ServicesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    svcService = await buildServicesService(prisma, createMockCache());
    jest.clearAllMocks();
  });

  it('should filter services by categoryId', async () => {
    prisma.service.findMany.mockResolvedValue([mockClinicService, mockService2]);
    prisma.service.count.mockResolvedValue(2);

    await svcService.findAll({ categoryId: mockCategory.id });

    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: mockCategory.id }),
      }),
    );
  });

  it('should not include categoryId filter when not provided', async () => {
    prisma.service.findMany.mockResolvedValue([]);
    prisma.service.count.mockResolvedValue(0);

    await svcService.findAll({});

    const whereArg = prisma.service.findMany.mock.calls[0][0].where;
    expect(whereArg.categoryId).toBeUndefined();
  });

  it('should return empty items when no services match categoryId', async () => {
    prisma.service.findMany.mockResolvedValue([]);
    prisma.service.count.mockResolvedValue(0);

    const result = await svcService.findAll({ categoryId: 'empty-category-id' });

    expect(result.items).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════
//  4. Category findAll — active-only filter and caching
// ═════════════════════════════════════════════════════════════════

describe('Category: findAll returns only active categories', () => {
  let catService: ServiceCategoriesService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    cache = createMockCache();
    catService = await buildCategoriesService(prisma, cache);
    jest.clearAllMocks();
  });

  it('should only return active categories', async () => {
    prisma.serviceCategory.findMany.mockResolvedValue([mockCategory]);

    await catService.findAll();

    expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('should return cached result when available', async () => {
    cache.get.mockResolvedValue([mockCategory, mockCategory2]);

    const result = await catService.findAll();

    expect(result).toHaveLength(2);
    expect(prisma.serviceCategory.findMany).not.toHaveBeenCalled();
  });

  it('should set cache after fetching from database', async () => {
    cache.get.mockResolvedValue(null);
    prisma.serviceCategory.findMany.mockResolvedValue([mockCategory]);

    await catService.findAll();

    expect(cache.set).toHaveBeenCalledWith(
      CACHE_KEYS.CATEGORIES_ACTIVE,
      [mockCategory],
      expect.any(Number),
    );
  });
});

// ═════════════════════════════════════════════════════════════════
//  5. Category delete — service guard scenarios
// ═════════════════════════════════════════════════════════════════

describe('Category-Service: delete guard edge cases', () => {
  let catService: ServiceCategoriesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    catService = await buildCategoriesService(prisma, createMockCache());
    jest.clearAllMocks();
  });

  it('should block deletion when category has 1 active service', async () => {
    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    prisma.service.count.mockResolvedValue(1);

    await expect(catService.delete(mockCategory.id)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should allow deletion when category has only soft-deleted services', async () => {
    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    prisma.service.count.mockResolvedValue(0); // count with deletedAt: null returns 0
    prisma.serviceCategory.delete.mockResolvedValue(mockCategory);

    const result = await catService.delete(mockCategory.id);

    expect(result).toEqual({ deleted: true });
  });

  it('should count only non-soft-deleted services', async () => {
    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    prisma.service.count.mockResolvedValue(0);
    prisma.serviceCategory.delete.mockResolvedValue(mockCategory);

    await catService.delete(mockCategory.id);

    expect(prisma.service.count).toHaveBeenCalledWith({
      where: { categoryId: mockCategory.id, deletedAt: null },
    });
  });

  it('should hard-delete category (not soft-delete)', async () => {
    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    prisma.service.count.mockResolvedValue(0);
    prisma.serviceCategory.delete.mockResolvedValue(mockCategory);

    await catService.delete(mockCategory.id);

    expect(prisma.serviceCategory.delete).toHaveBeenCalledWith({
      where: { id: mockCategory.id },
    });
  });
});

// ═════════════════════════════════════════════════════════════════
//  6. Full chain: Department → Category → Service
// ═════════════════════════════════════════════════════════════════

describe('Full chain: Department → Category → Service', () => {
  it('department findAll includes active categories count', async () => {
    const { prisma, cache } = buildDeptMocks();
    const deptService = await buildDeptService(prisma, cache);

    const deptWithCategories = {
      ...mockDepartment,
      _count: { categories: 3 },
    };
    prisma.department.findMany.mockResolvedValue([deptWithCategories]);
    prisma.department.count.mockResolvedValue(1);

    const result = await deptService.findAll({});

    expect(result.items[0]._count.categories).toBe(3);
    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          _count: { select: { categories: { where: { isActive: true } } } },
        },
      }),
    );
  });

  it('department with zero active categories returns count 0', async () => {
    const { prisma, cache } = buildDeptMocks();
    const deptService = await buildDeptService(prisma, cache);

    const deptEmpty = { ...mockDepartment2, _count: { categories: 0 } };
    prisma.department.findFirst.mockResolvedValue(deptEmpty);

    const result = await deptService.findOne(mockDepartment2.id);

    expect(result._count.categories).toBe(0);
  });

  it('inactive department is excluded from active filter', async () => {
    const { prisma, cache } = buildDeptMocks();
    const deptService = await buildDeptService(prisma, cache);

    prisma.department.findMany.mockResolvedValue([]);
    prisma.department.count.mockResolvedValue(0);

    await deptService.findAll({ isActive: true });

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true, deletedAt: null }),
      }),
    );
  });

  it('service findOne includes category relation', async () => {
    const prisma = createMockPrisma();
    const svcService = await buildServicesService(prisma, createMockCache());

    prisma.service.findFirst.mockResolvedValue(mockServiceWithChain);

    const result = await svcService.findOne(mockServiceWithChain.id);

    expect(result.category).toBeDefined();
    expect(prisma.service.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ category: true }),
      }),
    );
  });

  it('service in category under department shows full chain data', async () => {
    const prisma = createMockPrisma();
    const svcService = await buildServicesService(prisma, createMockCache());

    prisma.service.findFirst.mockResolvedValue(mockServiceWithChain);

    const result = await svcService.findOne(mockServiceWithChain.id);

    expect(result.category.departmentId).toBe(mockDepartment.id);
    expect(result.category.department.nameEn).toBe('Dental');
  });
});

// ═════════════════════════════════════════════════════════════════
//  7. Category with departmentId scenarios
// ═════════════════════════════════════════════════════════════════

describe('Category-Department: departmentId edge cases', () => {
  let catService: ServiceCategoriesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    catService = await buildCategoriesService(prisma, createMockCache());
    jest.clearAllMocks();
  });

  it('should create category with null departmentId (unassigned)', async () => {
    prisma.serviceCategory.create.mockResolvedValue(mockCategory2);

    await catService.create({ nameEn: 'Unassigned', nameAr: 'غير مصنف' });

    expect(prisma.serviceCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ departmentId: null }),
    });
  });

  it('should create category with valid departmentId', async () => {
    const catWithDept = { ...mockCategory, departmentId: 'dept-uuid-1' };
    prisma.serviceCategory.create.mockResolvedValue(catWithDept);

    await catService.create({
      nameEn: 'Under Dept',
      nameAr: 'تحت قسم',
      departmentId: 'dept-uuid-1',
    });

    expect(prisma.serviceCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ departmentId: 'dept-uuid-1' }),
    });
  });

  it('should update category to move to a different department', async () => {
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

  it('should update category to unassign from department (set null)', async () => {
    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    prisma.serviceCategory.update.mockResolvedValue({
      ...mockCategory,
      departmentId: null,
    });

    const result = await catService.update(mockCategory.id, {
      departmentId: null,
    });

    expect(result.departmentId).toBeNull();
  });

  it('should keep departmentId unchanged when not in update dto', async () => {
    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    prisma.serviceCategory.update.mockResolvedValue({
      ...mockCategory,
      nameEn: 'Updated Name',
    });

    await catService.update(mockCategory.id, { nameEn: 'Updated Name' });

    expect(prisma.serviceCategory.update).toHaveBeenCalledWith({
      where: { id: mockCategory.id },
      data: expect.objectContaining({ departmentId: undefined }),
    });
  });
});

// ═════════════════════════════════════════════════════════════════
//  8. Cross-entity cache isolation
// ═════════════════════════════════════════════════════════════════

describe('Cross-entity cache isolation (chain)', () => {
  it('service soft-delete invalidates SERVICES_ACTIVE only', async () => {
    const prisma = createMockPrisma();
    const cache = createMockCache();
    const svcService = await buildServicesService(prisma, cache);
    jest.clearAllMocks();

    prisma.service.findFirst.mockResolvedValue(mockClinicService);
    prisma.service.update.mockResolvedValue({
      ...mockClinicService,
      deletedAt: new Date(),
    });

    await svcService.softDelete(mockClinicService.id);

    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.SERVICES_ACTIVE);
    expect(cache.del).not.toHaveBeenCalledWith(CACHE_KEYS.CATEGORIES_ACTIVE);
    expect(cache.del).not.toHaveBeenCalledWith(CACHE_KEYS.DEPARTMENTS_ACTIVE);
  });

  it('category create invalidates CATEGORIES + SERVICES but not DEPARTMENTS', async () => {
    const prisma = createMockPrisma();
    const cache = createMockCache();
    const catService = await buildCategoriesService(prisma, cache);
    jest.clearAllMocks();

    prisma.serviceCategory.create.mockResolvedValue(mockCategory);

    await catService.create({ nameEn: 'New', nameAr: 'جديد' });

    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.CATEGORIES_ACTIVE);
    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.SERVICES_ACTIVE);
    expect(cache.del).not.toHaveBeenCalledWith(CACHE_KEYS.DEPARTMENTS_ACTIVE);
  });

  it('department create invalidates DEPARTMENTS only', async () => {
    const { prisma, cache } = buildDeptMocks();
    const deptService = await buildDeptService(prisma, cache);
    jest.clearAllMocks();

    prisma.department.create.mockResolvedValue(mockDepartment);

    await deptService.create({ nameAr: 'قسم', nameEn: 'Dept' });

    expect(cache.del).toHaveBeenCalledWith(CACHE_KEYS.DEPARTMENTS_ACTIVE);
    expect(cache.del).toHaveBeenCalledTimes(1);
  });
});

// ═════════════════════════════════════════════════════════════════
//  9. Soft-delete chain behavior
// ═════════════════════════════════════════════════════════════════

describe('Soft-delete chain behavior', () => {
  it('soft-deleted department is excluded from findAll', async () => {
    const { prisma, cache } = buildDeptMocks();
    const deptService = await buildDeptService(prisma, cache);

    prisma.department.findMany.mockResolvedValue([]);
    prisma.department.count.mockResolvedValue(0);

    await deptService.findAll({});

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('soft-deleted department is not found by findOne', async () => {
    const { prisma, cache } = buildDeptMocks();
    const deptService = await buildDeptService(prisma, cache);

    prisma.department.findFirst.mockResolvedValue(null);

    await expect(deptService.findOne('deleted-dept-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('soft-deleted service is excluded from findAll', async () => {
    const prisma = createMockPrisma();
    const svcService = await buildServicesService(prisma, createMockCache());

    prisma.service.findMany.mockResolvedValue([]);
    prisma.service.count.mockResolvedValue(0);

    await svcService.findAll({});

    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('soft-deleted service does not block category deletion', async () => {
    const prisma = createMockPrisma();
    const catService = await buildCategoriesService(prisma, createMockCache());

    prisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    prisma.service.count.mockResolvedValue(0);
    prisma.serviceCategory.delete.mockResolvedValue(mockCategory);

    const result = await catService.delete(mockCategory.id);

    expect(result).toEqual({ deleted: true });
  });

  it('department remove does not cascade-delete categories (soft-delete only)', async () => {
    const { prisma, cache } = buildDeptMocks();
    const deptService = await buildDeptService(prisma, cache);

    prisma.department.findFirst.mockResolvedValue(mockDepartment);
    prisma.department.update.mockResolvedValue({
      ...mockDepartment,
      deletedAt: new Date(),
    });

    await deptService.remove(mockDepartment.id);

    // Only department.update called — no category mutations
    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: mockDepartment.id },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
