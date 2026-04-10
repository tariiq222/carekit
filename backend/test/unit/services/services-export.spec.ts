/**
 * CareKit — ServicesService.exportServices() Unit Tests
 *
 * Tests:
 *   - exportServices() returns correct mapping (price ÷ 100 = SAR)
 *   - deletedAt !== null records are excluded
 *   - category name is resolved from relation
 *   - exportServices is a defined method on the service class
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from '../../../src/modules/services/services.service.js';
import { ServiceCategoriesService } from '../../../src/modules/services/service-categories.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import { IntakeFormsService } from '../../../src/modules/intake-forms/intake-forms.service.js';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

const mockPrismaService: any = {
  service: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrismaService),
  ),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockCategory = {
  id: 'category-uuid-1',
  nameEn: 'General Medicine',
  nameAr: 'الطب العام',
  sortOrder: 1,
  isActive: true,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
};

const mockActiveService = {
  id: 'service-uuid-1',
  nameEn: 'General Consultation',
  nameAr: 'استشارة عامة',
  descriptionEn: 'General medical consultation',
  descriptionAr: 'استشارة طبية عامة',
  categoryId: mockCategory.id,
  price: 15000, // 150.00 SAR in halalat
  duration: 30,
  isActive: true,
  isHidden: false,
  deletedAt: null,
  createdAt: new Date('2026-01-15T10:00:00Z'),
  updatedAt: new Date('2026-01-15'),
  category: mockCategory,
};

const mockHiddenService = {
  id: 'service-uuid-2',
  nameEn: 'VIP Consultation',
  nameAr: 'استشارة خاصة',
  descriptionEn: 'VIP consultation',
  descriptionAr: 'استشارة VIP',
  categoryId: mockCategory.id,
  price: 50000, // 500.00 SAR
  duration: 60,
  isActive: true,
  isHidden: true,
  deletedAt: null,
  createdAt: new Date('2026-01-16T10:00:00Z'),
  updatedAt: new Date('2026-01-16'),
  category: mockCategory,
};

// A soft-deleted service — must be excluded
const mockDeletedService = {
  id: 'service-uuid-3',
  nameEn: 'Deleted Service',
  nameAr: 'خدمة محذوفة',
  descriptionEn: 'Should not appear',
  descriptionAr: 'لن تظهر',
  categoryId: mockCategory.id,
  price: 2500,
  duration: 15,
  isActive: false,
  isHidden: false,
  deletedAt: new Date('2026-02-01'),
  createdAt: new Date('2026-01-10'),
  updatedAt: new Date('2026-02-01'),
  category: mockCategory,
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ServicesService — exportServices', () => {
  let service: ServicesService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        ServicesService,
        ServiceCategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        { provide: IntakeFormsService, useValue: { listForms: jest.fn() } },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    jest.clearAllMocks();
  });

  it('is a defined method on the service class', () => {
    expect(typeof service.exportServices).toBe('function');
  });

  it('maps price from halalat to SAR (price / 100)', async () => {
    mockPrismaService.service.findMany.mockResolvedValue([mockActiveService]);

    const result = await service.exportServices();

    expect(result).toHaveLength(1);
    expect(result[0].priceSar).toBe('150.00');
  });

  it('excludes soft-deleted services (deletedAt !== null)', async () => {
    // The service passes `where: { deletedAt: null }` to Prisma.
    // We verify the mock was called with that filter.
    mockPrismaService.service.findMany.mockResolvedValue([
      mockActiveService,
      mockHiddenService,
    ]);

    await service.exportServices();

    expect(mockPrismaService.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('resolves category name from relation (category.nameAr / nameEn)', async () => {
    mockPrismaService.service.findMany.mockResolvedValue([mockActiveService]);

    const result = await service.exportServices();

    expect(result[0]).toMatchObject({
      categoryAr: 'الطب العام',
      categoryEn: 'General Medicine',
    });
  });

  it('maps isActive and isHidden to Arabic yes/no strings', async () => {
    mockPrismaService.service.findMany.mockResolvedValue([
      mockActiveService,
      mockHiddenService,
    ]);

    const result = await service.exportServices();
    const active = result.find(
      (r: { id: string }) => r.id === 'service-uuid-1',
    )!;
    const hidden = result.find(
      (r: { id: string }) => r.id === 'service-uuid-2',
    )!;

    expect(active).toBeDefined();
    expect(hidden).toBeDefined();
    expect(active.isActive).toBe('نعم');
    expect(active.isHidden).toBe('لا');
    expect(hidden.isActive).toBe('نعم');
    expect(hidden.isHidden).toBe('نعم');
  });

  it('formats createdAt as ISO string', async () => {
    mockPrismaService.service.findMany.mockResolvedValue([mockActiveService]);

    const result = await service.exportServices();

    expect(result[0].createdAt).toBe('2026-01-15T10:00:00.000Z');
  });

  it('returns all fields required for CSV export', async () => {
    mockPrismaService.service.findMany.mockResolvedValue([mockActiveService]);

    const result = await service.exportServices();
    const row = result[0];

    expect(row).toHaveProperty('id');
    expect(row).toHaveProperty('nameAr');
    expect(row).toHaveProperty('nameEn');
    expect(row).toHaveProperty('categoryAr');
    expect(row).toHaveProperty('categoryEn');
    expect(row).toHaveProperty('priceSar');
    expect(row).toHaveProperty('durationMinutes');
    expect(row).toHaveProperty('isActive');
    expect(row).toHaveProperty('isHidden');
    expect(row).toHaveProperty('createdAt');
  });

  it('returns empty array when no active services exist', async () => {
    mockPrismaService.service.findMany.mockResolvedValue([]);

    const result = await service.exportServices();

    expect(result).toEqual([]);
  });

  it('orders results by createdAt ascending', async () => {
    // Service passes `orderBy: { createdAt: 'asc' }` to Prisma — verify the mock call
    mockPrismaService.service.findMany.mockResolvedValue([mockActiveService]);

    await service.exportServices();

    expect(mockPrismaService.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
      }),
    );
  });
});
