import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DepartmentsService } from '../../../src/modules/departments/departments.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import { CACHE_KEYS } from '../../../src/config/constants.js';
import { CreateDepartmentDto } from '../../../src/modules/departments/dto/create-department.dto.js';
import { UpdateDepartmentDto } from '../../../src/modules/departments/dto/update-department.dto.js';
import { ReorderDepartmentsDto } from '../../../src/modules/departments/dto/reorder-departments.dto.js';
import { DepartmentListQueryDto } from '../../../src/modules/departments/dto/department-list-query.dto.js';

const mockPrisma = {
  department: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCache = {
  del: jest.fn().mockResolvedValue(undefined),
};

const mockDepartment = {
  id: 'dept-uuid-1',
  nameAr: 'قسم الأسنان',
  nameEn: 'Dental',
  descriptionAr: 'وصف القسم',
  descriptionEn: 'Department description',
  icon: 'tooth',
  sortOrder: 1,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
  _count: { categories: 3 },
};

const mockDepartment2 = {
  id: 'dept-uuid-2',
  nameAr: 'قسم العيون',
  nameEn: 'Ophthalmology',
  descriptionAr: null,
  descriptionEn: null,
  icon: null,
  sortOrder: 2,
  isActive: false,
  deletedAt: null,
  createdAt: new Date('2026-01-16'),
  updatedAt: new Date('2026-01-16'),
  _count: { categories: 0 },
};

describe('DepartmentsService', () => {
  let service: DepartmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────
  // findAll
  // ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated results with meta', async () => {
      mockPrisma.department.findMany.mockResolvedValue([mockDepartment, mockDepartment2]);
      mockPrisma.department.count.mockResolvedValue(2);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        perPage: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should default page=1 and perPage=20 when not provided', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.department.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should use provided page and perPage', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.department.count.mockResolvedValue(0);

      await service.findAll({ page: 3, perPage: 10 });

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('should filter by isActive when provided', async () => {
      mockPrisma.department.findMany.mockResolvedValue([mockDepartment]);
      mockPrisma.department.count.mockResolvedValue(1);

      await service.findAll({ isActive: true });

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true, deletedAt: null }),
        }),
      );
    });

    it('should filter by search across nameAr and nameEn', async () => {
      mockPrisma.department.findMany.mockResolvedValue([mockDepartment]);
      mockPrisma.department.count.mockResolvedValue(1);

      await service.findAll({ search: 'Dental' });

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            OR: [
              { nameAr: { contains: 'Dental', mode: 'insensitive' } },
              { nameEn: { contains: 'Dental', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should always filter deletedAt: null', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.department.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('should order by sortOrder ascending', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.department.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { sortOrder: 'asc' } }),
      );
    });

    it('should include active categories count', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.department.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            _count: { select: { categories: { where: { isActive: true } } } },
          },
        }),
      );
    });

    it('should compute hasNextPage and hasPreviousPage correctly', async () => {
      mockPrisma.department.findMany.mockResolvedValue([mockDepartment]);
      mockPrisma.department.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, perPage: 10 });

      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(true);
      expect(result.meta.totalPages).toBe(3);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // findOne
  // ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a department by id', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(mockDepartment);

      const result = await service.findOne('dept-uuid-1');

      expect(result).toEqual(mockDepartment);
      expect(mockPrisma.department.findFirst).toHaveBeenCalledWith({
        where: { id: 'dept-uuid-1', deletedAt: null },
        include: {
          _count: { select: { categories: { where: { isActive: true } } } },
        },
      });
    });

    it('should throw NotFoundException when department does not exist', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with correct message', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            message: 'Department not found',
          }),
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────
  // create
  // ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateDepartmentDto = {
      nameAr: 'قسم جديد',
      nameEn: 'New Department',
      descriptionAr: 'وصف',
      descriptionEn: 'Description',
      icon: 'star',
      sortOrder: 5,
      isActive: true,
    };

    it('should create a department with all fields', async () => {
      mockPrisma.department.create.mockResolvedValue({
        id: 'new-uuid',
        ...createDto,
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(mockPrisma.department.create).toHaveBeenCalledWith({
        data: {
          nameAr: createDto.nameAr,
          nameEn: createDto.nameEn,
          descriptionAr: createDto.descriptionAr,
          descriptionEn: createDto.descriptionEn,
          icon: createDto.icon,
          sortOrder: 5,
          isActive: true,
        },
      });
    });

    it('should default sortOrder to 0 when not provided', async () => {
      const minimalDto: CreateDepartmentDto = {
        nameAr: 'قسم',
        nameEn: 'Dept',
      };
      mockPrisma.department.create.mockResolvedValue({
        id: 'new-uuid',
        ...minimalDto,
        sortOrder: 0,
        isActive: true,
      });

      await service.create(minimalDto);

      expect(mockPrisma.department.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sortOrder: 0 }),
      });
    });

    it('should default isActive to true when not provided', async () => {
      const minimalDto: CreateDepartmentDto = {
        nameAr: 'قسم',
        nameEn: 'Dept',
      };
      mockPrisma.department.create.mockResolvedValue({
        id: 'new-uuid',
        ...minimalDto,
        sortOrder: 0,
        isActive: true,
      });

      await service.create(minimalDto);

      expect(mockPrisma.department.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isActive: true }),
      });
    });

    it('should invalidate cache after creation', async () => {
      mockPrisma.department.create.mockResolvedValue({
        id: 'new-uuid',
        ...createDto,
      });

      await service.create(createDto);

      expect(mockCache.del).toHaveBeenCalledWith(CACHE_KEYS.DEPARTMENTS_ACTIVE);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // update
  // ───────────────────────────────────────────────────────────────

  describe('update', () => {
    const updateDto: UpdateDepartmentDto = {
      nameAr: 'اسم محدث',
      sortOrder: 10,
    };

    it('should update a department', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrisma.department.update.mockResolvedValue({
        ...mockDepartment,
        ...updateDto,
      });

      const result = await service.update('dept-uuid-1', updateDto);

      expect(result.nameAr).toBe('اسم محدث');
      expect(result.sortOrder).toBe(10);
      expect(mockPrisma.department.update).toHaveBeenCalledWith({
        where: { id: 'dept-uuid-1' },
        data: {
          nameAr: updateDto.nameAr,
          nameEn: undefined,
          descriptionAr: undefined,
          descriptionEn: undefined,
          icon: undefined,
          sortOrder: updateDto.sortOrder,
          isActive: undefined,
        },
      });
    });

    it('should throw NotFoundException when department does not exist', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.update('non-existent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should invalidate cache after update', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrisma.department.update.mockResolvedValue({
        ...mockDepartment,
        ...updateDto,
      });

      await service.update('dept-uuid-1', updateDto);

      expect(mockCache.del).toHaveBeenCalledWith(CACHE_KEYS.DEPARTMENTS_ACTIVE);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // remove
  // ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should soft delete by setting deletedAt', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrisma.department.update.mockResolvedValue({
        ...mockDepartment,
        deletedAt: new Date(),
      });

      const result = await service.remove('dept-uuid-1');

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.department.update).toHaveBeenCalledWith({
        where: { id: 'dept-uuid-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException when department does not exist', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should invalidate cache after removal', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrisma.department.update.mockResolvedValue({
        ...mockDepartment,
        deletedAt: new Date(),
      });

      await service.remove('dept-uuid-1');

      expect(mockCache.del).toHaveBeenCalledWith(CACHE_KEYS.DEPARTMENTS_ACTIVE);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // reorder
  // ───────────────────────────────────────────────────────────────

  describe('reorder', () => {
    const reorderDto: ReorderDepartmentsDto = {
      items: [
        { id: 'dept-uuid-1', sortOrder: 2 },
        { id: 'dept-uuid-2', sortOrder: 1 },
      ],
    };

    it('should call $transaction with correct updates', async () => {
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.reorder(reorderDto);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith([
        mockPrisma.department.update({
          where: { id: 'dept-uuid-1' },
          data: { sortOrder: 2 },
        }),
        mockPrisma.department.update({
          where: { id: 'dept-uuid-2' },
          data: { sortOrder: 1 },
        }),
      ]);
    });

    it('should return { reordered: true }', async () => {
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.reorder(reorderDto);

      expect(result).toEqual({ reordered: true });
    });

    it('should invalidate cache after reorder', async () => {
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.reorder(reorderDto);

      expect(mockCache.del).toHaveBeenCalledWith(CACHE_KEYS.DEPARTMENTS_ACTIVE);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Cache invalidation (cross-cutting)
  // ───────────────────────────────────────────────────────────────

  describe('cache invalidation', () => {
    it('should call cache.del with DEPARTMENTS_ACTIVE key on create', async () => {
      mockPrisma.department.create.mockResolvedValue(mockDepartment);
      await service.create({ nameAr: 'قسم', nameEn: 'Dept' });
      expect(mockCache.del).toHaveBeenCalledTimes(1);
      expect(mockCache.del).toHaveBeenCalledWith(CACHE_KEYS.DEPARTMENTS_ACTIVE);
    });

    it('should call cache.del with DEPARTMENTS_ACTIVE key on update', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrisma.department.update.mockResolvedValue(mockDepartment);
      await service.update('dept-uuid-1', { nameAr: 'تحديث' });
      expect(mockCache.del).toHaveBeenCalledTimes(1);
    });

    it('should call cache.del with DEPARTMENTS_ACTIVE key on remove', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrisma.department.update.mockResolvedValue(mockDepartment);
      await service.remove('dept-uuid-1');
      expect(mockCache.del).toHaveBeenCalledTimes(1);
    });

    it('should call cache.del with DEPARTMENTS_ACTIVE key on reorder', async () => {
      mockPrisma.$transaction.mockResolvedValue([]);
      await service.reorder({ items: [{ id: 'dept-uuid-1', sortOrder: 0 }] });
      expect(mockCache.del).toHaveBeenCalledTimes(1);
    });
  });
});
