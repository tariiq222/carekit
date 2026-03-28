/**
 * ServicesService — Service CRUD Tests
 * Covers: create, findAll, findOne, update, softDelete
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ServicesService } from '../../../src/modules/services/services.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import { IntakeFormsService } from '../../../src/modules/intake-forms/intake-forms.service.js';
import { MinioService } from '../../../src/common/services/minio.service.js';
import { CreateServiceDto } from '../../../src/modules/services/dto/create-service.dto.js';
import {
  createMockPrisma,
  createMockCache,
  mockCategory,
  mockCategory2,
  mockClinicService,
} from './services.fixtures.js';

async function createModule(mockPrisma: ReturnType<typeof createMockPrisma>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ServicesService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: CacheService, useValue: createMockCache() },
      { provide: IntakeFormsService, useValue: { listForms: jest.fn() } },
      { provide: MinioService, useValue: { uploadFile: jest.fn(), deleteFile: jest.fn() } },
    ],
  }).compile();
  return module.get<ServicesService>(ServicesService);
}

describe('ServicesService — create', () => {
  let service: ServicesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  const createDto = {
    nameEn: 'General Consultation',
    nameAr: 'استشارة عامة',
    categoryId: mockCategory.id,
    price: 15000,
    duration: 30,
  };

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should create a service with valid data', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.service.create.mockResolvedValue({ ...mockClinicService, ...createDto });

    const result = await service.create(createDto);

    expect(result.nameEn).toBe(createDto.nameEn);
    expect(result.price).toBe(15000);
    expect(mockPrisma.service.create).toHaveBeenCalled();
  });

  it.each([
    ['price', { price: 0 }, { price: 0 }],
    ['duration', { duration: 30 }, { duration: 30 }],
  ])('should default %s when not provided', async (_field, _override, expectedData) => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.service.create.mockResolvedValue({ ...mockClinicService, ...expectedData });

    await service.create({ nameEn: 'Test', nameAr: 'اختبار', categoryId: mockCategory.id });

    expect(mockPrisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining(expectedData) }),
    );
  });

  it('should store price as integer (halalat)', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.service.create.mockResolvedValue({ ...mockClinicService, price: 25050 });

    await service.create({ ...createDto, price: 25050 });

    expect(mockPrisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ price: 25050 }) }),
    );
  });

  it('should throw NotFoundException if category does not exist', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(null);

    await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
  });

  it('should persist depositEnabled and depositPercent to the DB', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.service.create.mockResolvedValue({
      ...mockClinicService,
      depositEnabled: true,
      depositPercent: 50,
    });

    await service.create({ ...createDto, depositEnabled: true, depositPercent: 50 });

    expect(mockPrisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ depositEnabled: true, depositPercent: 50 }),
      }),
    );
  });

  it('should persist allowRecurring and allowedRecurringPatterns to the DB', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.service.create.mockResolvedValue({
      ...mockClinicService,
      allowRecurring: true,
      allowedRecurringPatterns: ['WEEKLY'],
    });

    await service.create({
      ...createDto,
      allowRecurring: true,
      allowedRecurringPatterns: ['WEEKLY'] as CreateServiceDto['allowedRecurringPatterns'],
    });

    expect(mockPrisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allowRecurring: true,
          allowedRecurringPatterns: ['WEEKLY'],
        }),
      }),
    );
  });

  it('should persist minLeadMinutes and maxAdvanceDays to the DB', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory);
    mockPrisma.service.create.mockResolvedValue({
      ...mockClinicService,
      minLeadMinutes: 60,
      maxAdvanceDays: 30,
    });

    await service.create({ ...createDto, minLeadMinutes: 60, maxAdvanceDays: 30 });

    expect(mockPrisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ minLeadMinutes: 60, maxAdvanceDays: 30 }),
      }),
    );
  });
});

describe('ServicesService — findAll', () => {
  let service: ServicesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should return paginated services with default page=1, perPage=20', async () => {
    mockPrisma.service.findMany.mockResolvedValue([mockClinicService]);
    mockPrisma.service.count.mockResolvedValue(1);

    const result = await service.findAll({});

    expect(result).toHaveProperty('items');
    expect(result.meta).toMatchObject({ page: 1, perPage: 20, total: 1 });
  });

  it('should apply pagination correctly', async () => {
    mockPrisma.service.findMany.mockResolvedValue([]);
    mockPrisma.service.count.mockResolvedValue(100);

    const result = await service.findAll({ page: 3, perPage: 10 });

    expect(result.meta.totalPages).toBe(10);
    expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it.each([
    [{ categoryId: mockCategory.id }, { categoryId: mockCategory.id }],
    [{ isActive: true }, { isActive: true }],
    [{ }, { deletedAt: null }],
  ])('should apply where filter for %o', async (filter, expectedWhere) => {
    mockPrisma.service.findMany.mockResolvedValue([]);
    mockPrisma.service.count.mockResolvedValue(0);

    await service.findAll(filter);

    expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(expectedWhere) }),
    );
  });

  it('should search by name (English and Arabic)', async () => {
    mockPrisma.service.findMany.mockResolvedValue([mockClinicService]);
    mockPrisma.service.count.mockResolvedValue(1);

    await service.findAll({ search: 'Consultation' });

    expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ nameEn: expect.objectContaining({ contains: 'Consultation' }) }),
            expect.objectContaining({ nameAr: expect.objectContaining({ contains: 'Consultation' }) }),
          ]),
        }),
      }),
    );
  });

  it('should include category relation', async () => {
    mockPrisma.service.findMany.mockResolvedValue([mockClinicService]);
    mockPrisma.service.count.mockResolvedValue(1);

    await service.findAll({});

    expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ category: true }) }),
    );
  });
});

describe('ServicesService — findOne', () => {
  let service: ServicesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should return a service with category details', async () => {
    mockPrisma.service.findFirst.mockResolvedValue(mockClinicService);

    const result = await service.findOne(mockClinicService.id);

    expect(result.id).toBe(mockClinicService.id);
    expect(result.category).toBeDefined();
  });

  it('should query with deletedAt: null filter', async () => {
    mockPrisma.service.findFirst.mockResolvedValue(null);

    await expect(service.findOne(mockClinicService.id)).rejects.toThrow(NotFoundException);

    expect(mockPrisma.service.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: mockClinicService.id, deletedAt: null }) }),
    );
  });

  it('should throw NotFoundException for non-existent service', async () => {
    mockPrisma.service.findFirst.mockResolvedValue(null);

    await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
  });
});

describe('ServicesService — update', () => {
  let service: ServicesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should update service fields', async () => {
    const updateDto = { descriptionEn: 'Updated description', price: 20000, duration: 45 };
    mockPrisma.service.findFirst.mockResolvedValue(mockClinicService);
    mockPrisma.service.update.mockResolvedValue({ ...mockClinicService, ...updateDto });

    const result = await service.update(mockClinicService.id, updateDto);

    expect(result.price).toBe(20000);
    expect(result.duration).toBe(45);
  });

  it('should validate category exists when updating categoryId', async () => {
    mockPrisma.service.findFirst.mockResolvedValue(mockClinicService);
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(null);

    await expect(
      service.update(mockClinicService.id, { categoryId: 'invalid-category' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should allow changing category to a valid one', async () => {
    mockPrisma.service.findFirst.mockResolvedValue(mockClinicService);
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(mockCategory2);
    mockPrisma.service.update.mockResolvedValue({
      ...mockClinicService,
      categoryId: mockCategory2.id,
      category: mockCategory2,
    });

    const result = await service.update(mockClinicService.id, { categoryId: mockCategory2.id });

    expect(result.categoryId).toBe(mockCategory2.id);
  });

  it('should throw NotFoundException if service not found', async () => {
    mockPrisma.service.findFirst.mockResolvedValue(null);

    await expect(service.update('non-existent-id', { price: 10000 })).rejects.toThrow(NotFoundException);
  });
});

describe('ServicesService — softDelete', () => {
  let service: ServicesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should set deletedAt timestamp', async () => {
    mockPrisma.service.findFirst.mockResolvedValue(mockClinicService);
    mockPrisma.service.update.mockResolvedValue({ ...mockClinicService, deletedAt: new Date() });

    await service.softDelete(mockClinicService.id);

    expect(mockPrisma.service.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockClinicService.id },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('should throw NotFoundException if service not found or already deleted', async () => {
    mockPrisma.service.findFirst.mockResolvedValue(null);

    await expect(service.softDelete('non-existent-id')).rejects.toThrow(NotFoundException);
  });
});
