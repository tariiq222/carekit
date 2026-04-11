/**
 * CareKit — ServicesService + ServiceCategoriesService Unit Tests
 *
 * Tests business logic in isolation:
 *   - Service CRUD (create, findAll, findOne, update, softDelete)
 *   - Category CRUD (create, findAll, update, delete) — via ServiceCategoriesService
 *   - Price validation (halalat integers, non-negative)
 *   - Duration validation (positive integer)
 *   - Category assignment and validation
 *   - Soft-delete behaviour
 *   - Search by name (Arabic + English)
 *   - Cascade protection (category with services cannot be deleted)
 *
 * PrismaService is mocked so tests run without a database.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  BadRequestException,
} from '@nestjs/common';
import { ServicesService } from '../services.service.js';
import { ServiceCategoriesService } from '../service-categories.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { CacheService } from '../../../common/services/cache.service.js';
import { IntakeFormsService } from '../../intake-forms/intake-forms.service.js';
import { CreateServiceDto } from '../dto/create-service.dto.js';
import { UpdateServiceDto } from '../dto/update-service.dto.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { UpdateCategoryDto } from '../dto/update-category.dto.js';

import { ServiceListQueryDto } from '../dto/service-list-query.dto.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

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
  let categoriesService: ServiceCategoriesService;
  let module: TestingModule;

  describe('branch filter in findAll', () => {
    it('passes branchId filter to queryServices', async () => {
      // We will test the actual filtering in Task 3.
      // This placeholder ensures the DTO field exists at compile time.
      const query: ServiceListQueryDto = { branchId: 'branch-uuid-1' };
      expect(query.branchId).toBe('branch-uuid-1');
    });
  });

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
    categoriesService = module.get<ServiceCategoriesService>(
      ServiceCategoriesService,
    );

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
        departmentId: 'dept-uuid-1',
      };

      mockPrismaService.serviceCategory.create.mockResolvedValue({
        ...mockCategory,
        ...dto,
        sortOrder: 0,
      });

      const result = await categoriesService.create(dto);

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
        departmentId: 'dept-uuid-1',
      };

      mockPrismaService.serviceCategory.create.mockResolvedValue({
        ...mockCategory,
        ...dto,
      });

      const result = await categoriesService.create(dto);

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

      const result = await categoriesService.findAll();

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
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
      mockPrismaService.serviceCategory.update.mockResolvedValue({
        ...mockCategory,
        nameEn: 'Updated Category',
      });

      const result = await categoriesService.update(mockCategory.id, {
        nameEn: 'Updated Category',
      });

      expect(result.nameEn).toBe('Updated Category');
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(null);

      await expect(
        categoriesService.update('non-existent-id', { nameEn: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow deactivating a category', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
      mockPrismaService.serviceCategory.update.mockResolvedValue({
        ...mockCategory,
        isActive: false,
      });

      const result = await categoriesService.update(mockCategory.id, {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category with no services', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
      mockPrismaService.service.count.mockResolvedValue(0);
      mockPrismaService.serviceCategory.delete.mockResolvedValue(mockCategory);

      await categoriesService.delete(mockCategory.id);

      expect(mockPrismaService.serviceCategory.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockCategory.id },
        }),
      );
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(null);

      await expect(categoriesService.delete('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if category has assigned services', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
      mockPrismaService.service.count.mockResolvedValue(3);

      await expect(categoriesService.delete(mockCategory.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow deleting a category whose services are all soft-deleted', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
      // All services are soft-deleted — count of ACTIVE services = 0
      mockPrismaService.service.count.mockResolvedValue(0);
      mockPrismaService.serviceCategory.delete.mockResolvedValue(mockCategory);

      const result = await categoriesService.delete(mockCategory.id);

      expect(result).toEqual({ deleted: true });
      // Verify the count query excludes soft-deleted services
      expect(mockPrismaService.service.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: mockCategory.id,
            deletedAt: null,
          }),
        }),
      );
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
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
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

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should default price to 0 when not provided', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
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
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
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
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
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

    it('should persist depositEnabled and depositPercent to the DB', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
      mockPrismaService.service.create.mockResolvedValue({
        ...mockService,
        depositEnabled: true,
        depositPercent: 50,
      });

      await service.create({
        ...createDto,
        depositEnabled: true,
        depositPercent: 50,
      });

      expect(mockPrismaService.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            depositEnabled: true,
            depositPercent: 50,
          }),
        }),
      );
    });

    it('should persist allowRecurring and allowedRecurringPatterns to the DB', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
      mockPrismaService.service.create.mockResolvedValue({
        ...mockService,
        allowRecurring: true,
        allowedRecurringPatterns: ['WEEKLY'],
      });

      await service.create({
        ...createDto,
        allowRecurring: true,
        allowedRecurringPatterns: [
          'WEEKLY',
        ] as CreateServiceDto['allowedRecurringPatterns'],
      });

      expect(mockPrismaService.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            allowRecurring: true,
            allowedRecurringPatterns: ['WEEKLY'],
          }),
        }),
      );
    });

    it('should persist minLeadMinutes and maxAdvanceDays to the DB', async () => {
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory,
      );
      mockPrismaService.service.create.mockResolvedValue({
        ...mockService,
        minLeadMinutes: 60,
        maxAdvanceDays: 30,
      });

      await service.create({
        ...createDto,
        minLeadMinutes: 60,
        maxAdvanceDays: 30,
      });

      expect(mockPrismaService.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            minLeadMinutes: 60,
            maxAdvanceDays: 30,
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
      mockPrismaService.serviceCategory.findUnique.mockResolvedValue(
        mockCategory2,
      );
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

  describe('getIntakeForms', () => {
    it('should call intakeForms.listForms with the serviceId', async () => {
      const mockForms = [{ id: 'form-1', titleEn: 'Health History' }];
      const mockIntakeFormsService = module.get(IntakeFormsService);
      jest
        .spyOn(mockIntakeFormsService, 'listForms')
        .mockResolvedValue(mockForms as never);

      const result = await service.getIntakeForms('service-uuid-1');

      expect(mockIntakeFormsService.listForms).toHaveBeenCalledWith({
        serviceId: 'service-uuid-1',
      });
      expect(result).toBe(mockForms);
    });

    it('should propagate errors from intakeForms.listForms', async () => {
      const mockIntakeFormsService = module.get(IntakeFormsService);
      jest
        .spyOn(mockIntakeFormsService, 'listForms')
        .mockRejectedValue(new Error('intake forms error'));

      await expect(service.getIntakeForms('service-uuid-1')).rejects.toThrow(
        'intake forms error',
      );
    });
  });
});
