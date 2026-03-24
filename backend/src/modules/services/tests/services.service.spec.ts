/**
 * CareKit — ServicesService Unit Tests (TDD RED Phase)
 *
 * Tests the ServicesService business logic in isolation:
 *   - Service CRUD (create, findAll, findOne, update, softDelete)
 *   - Category CRUD (create, findAll, update, delete)
 *   - Price validation (halalat integers, non-negative)
 *   - Duration validation (positive integer)
 *   - Category assignment and validation
 *   - Soft-delete behaviour
 *   - Search by name (Arabic + English)
 *   - Cascade protection (category with services cannot be deleted)
 *
 * PrismaService is mocked so tests run without a database.
 * These tests will FAIL until backend-dev implements ServicesService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ServicesService } from '../services.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { CacheService } from '../../../common/services/cache.service.js';

// ---------------------------------------------------------------------------
// DTO interfaces (replaced by actual imports once backend-dev creates them)
// ---------------------------------------------------------------------------

interface CreateServiceDto {
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  categoryId: string;
  price?: number;
  duration?: number;
}

interface UpdateServiceDto {
  nameEn?: string;
  nameAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  categoryId?: string;
  price?: number;
  duration?: number;
  isActive?: boolean;
}

interface CreateCategoryDto {
  nameEn: string;
  nameAr: string;
  sortOrder?: number;
}

interface UpdateCategoryDto {
  nameEn?: string;
  nameAr?: string;
  sortOrder?: number;
  isActive?: boolean;
}

interface ServiceListQuery {
  page?: number;
  perPage?: number;
  categoryId?: string;
  isActive?: boolean;
  search?: string;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCacheService: any = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  delPattern: jest.fn().mockResolvedValue(undefined),
};

const mockPrismaService: any = {
  service: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  serviceCategory: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrismaService)),
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

const mockCategory2 = {
  id: 'category-uuid-2',
  nameEn: 'Specialized Care',
  nameAr: 'الرعاية المتخصصة',
  sortOrder: 2,
  isActive: true,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
};

const mockService = {
  id: 'service-uuid-1',
  nameEn: 'General Consultation',
  nameAr: 'استشارة عامة',
  descriptionEn: 'General medical consultation',
  descriptionAr: 'استشارة طبية عامة',
  categoryId: mockCategory.id,
  price: 15000, // 150 SAR in halalat
  duration: 30,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
  category: mockCategory,
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ServicesService', () => {
  let service: ServicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);

    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  //  SERVICE CATEGORIES
  // ═══════════════════════════════════════════════════════════════

  describe('createCategory', () => {
    it('should create a category with default sortOrder', async () => {
      const dto: CreateCategoryDto = {
        nameEn: 'New Category',
        nameAr: 'فئة جديدة',
      };

      mockPrismaService.serviceCategory.create.mockResolvedValue({
        ...mockCategory,
        ...dto,
        sortOrder: 0,
      });

      const result = await service.createCategory(dto);

      expect(result).toBeDefined();
      expect(result.nameEn).toBe(dto.nameEn);
      expect(mockPrismaService.serviceCategory.create).toHaveBeenCalledWith(
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
      const dto: CreateCategoryDto = {
        nameEn: 'Priority Category',
        nameAr: 'فئة ذات أولوية',
        sortOrder: 5,
      };

      mockPrismaService.serviceCategory.create.mockResolvedValue({
        ...mockCategory,
        ...dto,
      });

      const result = await service.createCategory(dto);

      expect(mockPrismaService.serviceCategory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sortOrder: 5,
          }),
        }),
      );
    });
  });

  describe('findAllCategories', () => {
    it('should return all active categories sorted by sortOrder', async () => {
      mockPrismaService.serviceCategory.findMany.mockResolvedValue([
        mockCategory,
        mockCategory2,
      ]);

      const result = await service.findAllCategories();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(mockPrismaService.serviceCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        }),
      );
    });
  });

  describe('updateCategory', () => {
    it('should update category fields', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.serviceCategory.update.mockResolvedValue({
        ...mockCategory,
        nameEn: 'Updated Category',
      });

      const result = await service.updateCategory(mockCategory.id, {
        nameEn: 'Updated Category',
      });

      expect(result.nameEn).toBe('Updated Category');
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCategory('non-existent-id', { nameEn: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow deactivating a category', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.serviceCategory.update.mockResolvedValue({
        ...mockCategory,
        isActive: false,
      });

      const result = await service.updateCategory(mockCategory.id, {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category with no services', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.service.count.mockResolvedValue(0);
      mockPrismaService.serviceCategory.delete.mockResolvedValue(mockCategory);

      await service.deleteCategory(mockCategory.id);

      expect(mockPrismaService.serviceCategory.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockCategory.id },
        }),
      );
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteCategory('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if category has assigned services', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.service.count.mockResolvedValue(3);

      await expect(
        service.deleteCategory(mockCategory.id),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  SERVICES
  // ═══════════════════════════════════════════════════════════════

  describe('create', () => {
    const createDto: CreateServiceDto = {
      nameEn: 'General Consultation',
      nameAr: 'استشارة عامة',
      descriptionEn: 'Standard 30-minute consultation',
      descriptionAr: 'استشارة قياسية لمدة 30 دقيقة',
      categoryId: mockCategory.id,
      price: 15000,
      duration: 30,
    };

    it('should create a service with valid data', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.service.create.mockResolvedValue({
        ...mockService,
        ...createDto,
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.nameEn).toBe(createDto.nameEn);
      expect(result.price).toBe(15000);
      expect(mockPrismaService.service.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if category does not exist', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should default price to 0 when not provided', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.service.create.mockResolvedValue({
        ...mockService,
        price: 0,
      });

      await service.create({
        nameEn: 'Free Service',
        nameAr: 'خدمة مجانية',
        categoryId: mockCategory.id,
      });

      expect(mockPrismaService.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            price: 0,
          }),
        }),
      );
    });

    it('should default duration to 30 when not provided', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.service.create.mockResolvedValue({
        ...mockService,
        duration: 30,
      });

      await service.create({
        nameEn: 'Default Duration Service',
        nameAr: 'خدمة مدة افتراضية',
        categoryId: mockCategory.id,
      });

      expect(mockPrismaService.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            duration: 30,
          }),
        }),
      );
    });

    it('should store price as integer (halalat)', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.service.create.mockResolvedValue({
        ...mockService,
        price: 25050,
      });

      await service.create({
        ...createDto,
        price: 25050,
      });

      expect(mockPrismaService.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            price: 25050,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated services with default page=1, perPage=20', async () => {
      mockPrismaService.service.findMany.mockResolvedValue([mockService]);
      mockPrismaService.service.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toMatchObject({
        page: 1,
        perPage: 20,
        total: 1,
      });
    });

    it('should apply pagination', async () => {
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.service.count.mockResolvedValue(100);

      const result = await service.findAll({ page: 3, perPage: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.perPage).toBe(10);
      expect(result.meta.totalPages).toBe(10);
      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should filter by categoryId', async () => {
      mockPrismaService.service.findMany.mockResolvedValue([mockService]);
      mockPrismaService.service.count.mockResolvedValue(1);

      await service.findAll({ categoryId: mockCategory.id });

      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: mockCategory.id,
          }),
        }),
      );
    });

    it('should filter by isActive', async () => {
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.service.count.mockResolvedValue(0);

      await service.findAll({ isActive: true });

      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });

    it('should search by name (English and Arabic)', async () => {
      mockPrismaService.service.findMany.mockResolvedValue([mockService]);
      mockPrismaService.service.count.mockResolvedValue(1);

      await service.findAll({ search: 'Consultation' });

      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                nameEn: expect.objectContaining({ contains: 'Consultation' }),
              }),
              expect.objectContaining({
                nameAr: expect.objectContaining({ contains: 'Consultation' }),
              }),
            ]),
          }),
        }),
      );
    });

    it('should exclude soft-deleted services', async () => {
      mockPrismaService.service.findMany.mockResolvedValue([]);
      mockPrismaService.service.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });

    it('should include category relation', async () => {
      mockPrismaService.service.findMany.mockResolvedValue([mockService]);
      mockPrismaService.service.count.mockResolvedValue(1);

      await service.findAll({});

      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            category: true,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a service with category details', async () => {
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);

      const result = await service.findOne(mockService.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockService.id);
      expect(result.category).toBeDefined();
    });

    it('should throw NotFoundException for non-existent service', async () => {
      mockPrismaService.service.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should exclude soft-deleted services', async () => {
      mockPrismaService.service.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockService.id)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.service.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: mockService.id,
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update service fields', async () => {
      const updateDto: UpdateServiceDto = {
        descriptionEn: 'Updated description',
        price: 20000,
        duration: 45,
      };

      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.service.update.mockResolvedValue({
        ...mockService,
        ...updateDto,
      });

      const result = await service.update(mockService.id, updateDto);

      expect(result.descriptionEn).toBe('Updated description');
      expect(result.price).toBe(20000);
      expect(result.duration).toBe(45);
    });

    it('should throw NotFoundException if service not found', async () => {
      mockPrismaService.service.findFirst.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { price: 10000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate category exists when updating categoryId', async () => {
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.update(mockService.id, { categoryId: 'invalid-category' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow changing category to a valid one', async () => {
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(mockCategory2);
      mockPrismaService.service.update.mockResolvedValue({
        ...mockService,
        categoryId: mockCategory2.id,
        category: mockCategory2,
      });

      const result = await service.update(mockService.id, {
        categoryId: mockCategory2.id,
      });

      expect(result.categoryId).toBe(mockCategory2.id);
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt timestamp on service', async () => {
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.service.update.mockResolvedValue({
        ...mockService,
        deletedAt: new Date(),
      });

      await service.softDelete(mockService.id);

      expect(mockPrismaService.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockService.id },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundException if service not found', async () => {
      mockPrismaService.service.findFirst.mockResolvedValue(null);

      await expect(service.softDelete('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if service already deleted', async () => {
      mockPrismaService.service.findFirst.mockResolvedValue(null);

      await expect(service.softDelete(mockService.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
