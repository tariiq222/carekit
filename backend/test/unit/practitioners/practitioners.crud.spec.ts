/**
 * PractitionersService — CRUD Tests
 * Covers: findAll, findOne, create, update, softDelete
 */
import { NotFoundException, ConflictException } from '@nestjs/common';
import {
  createPractitionersTestModule,
  PractitionersTestContext,
} from './practitioners.test-module.js';
import { mockUser, mockPractitioner } from './practitioners.fixtures.js';

describe('PractitionersService — findAll', () => {
  let ctx: PractitionersTestContext;

  beforeEach(async () => {
    ctx = await createPractitionersTestModule();
    jest.clearAllMocks();
  });

  it('should return paginated practitioners with default page=1, perPage=20', async () => {
    ctx.mockPrisma.practitioner.findMany.mockResolvedValue([mockPractitioner]);
    ctx.mockPrisma.practitioner.count.mockResolvedValue(1);

    const result = await ctx.service.findAll({});

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('meta');
    expect(result.meta).toMatchObject({ page: 1, perPage: 20, total: 1, totalPages: 1 });
    expect(result.items).toHaveLength(1);
  });

  it('should apply pagination correctly', async () => {
    ctx.mockPrisma.practitioner.findMany.mockResolvedValue([]);
    ctx.mockPrisma.practitioner.count.mockResolvedValue(50);

    const result = await ctx.service.findAll({ page: 3, perPage: 10 });

    expect(result.meta.page).toBe(3);
    expect(result.meta.perPage).toBe(10);
    expect(result.meta.totalPages).toBe(5);
    expect(ctx.mockPrisma.practitioner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it.each([
    [{ specialty: 'Cardiology' }, { OR: expect.arrayContaining([expect.objectContaining({ specialty: expect.objectContaining({ contains: 'Cardiology' }) })]) }],
    [{ isActive: true }, { isActive: true }],
  ])('should filter by %o', async (filter, expectedWhere) => {
    ctx.mockPrisma.practitioner.findMany.mockResolvedValue([]);
    ctx.mockPrisma.practitioner.count.mockResolvedValue(0);

    await ctx.service.findAll(filter);

    expect(ctx.mockPrisma.practitioner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(expectedWhere) }),
    );
  });

  it('should search by user name', async () => {
    ctx.mockPrisma.practitioner.findMany.mockResolvedValue([mockPractitioner]);
    ctx.mockPrisma.practitioner.count.mockResolvedValue(1);

    await ctx.service.findAll({ search: 'خالد' });

    expect(ctx.mockPrisma.practitioner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ firstName: expect.objectContaining({ contains: 'خالد' }) }),
            ]),
          }),
        }),
      }),
    );
  });

  it('should exclude soft-deleted practitioners', async () => {
    ctx.mockPrisma.practitioner.findMany.mockResolvedValue([]);
    ctx.mockPrisma.practitioner.count.mockResolvedValue(0);

    await ctx.service.findAll({});

    expect(ctx.mockPrisma.practitioner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('should filter practitioners by serviceId', async () => {
    const mockServiceId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    ctx.mockPrisma.practitioner.findMany.mockResolvedValue([]);
    ctx.mockPrisma.practitioner.count.mockResolvedValue(0);

    await ctx.service.findAll({ serviceId: mockServiceId });

    expect(ctx.mockPrisma.practitioner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          services: { some: { serviceId: mockServiceId } },
        }),
      }),
    );
  });

  it('should sort by rating descending by default', async () => {
    ctx.mockPrisma.practitioner.findMany.mockResolvedValue([]);
    ctx.mockPrisma.practitioner.count.mockResolvedValue(0);

    await ctx.service.findAll({});

    expect(ctx.mockPrisma.practitioner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: expect.objectContaining({ rating: 'desc' }) }),
    );
  });
});

describe('PractitionersService — findOne', () => {
  let ctx: PractitionersTestContext;

  beforeEach(async () => {
    ctx = await createPractitionersTestModule();
    jest.clearAllMocks();
  });

  it('should return a practitioner with all relations', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

    const result = await ctx.service.findOne(mockPractitioner.id);

    expect(result.id).toBe(mockPractitioner.id);
    expect(ctx.mockPrisma.practitioner.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockPractitioner.id, deletedAt: null } }),
    );
  });

  it.each([
    ['non-existent practitioner', null, 'non-existent-id'],
    ['soft-deleted practitioner', null, mockPractitioner.id],
  ])('should throw NotFoundException for %s', async (_label, returnValue, id) => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(returnValue);

    await expect(ctx.service.findOne(id)).rejects.toThrow(NotFoundException);
  });
});

describe('PractitionersService — create', () => {
  let ctx: PractitionersTestContext;

  const createDto = {
    userId: mockUser.id,
    specialty: 'Cardiology',
    specialtyAr: 'أمراض القلب',
    bio: 'New cardiologist',
    bioAr: 'طبيب قلب جديد',
    experience: 5,
  };

  beforeEach(async () => {
    ctx = await createPractitionersTestModule();
    jest.clearAllMocks();
  });

  it('should create a practitioner record', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(null);
    ctx.mockPrisma.practitioner.create.mockResolvedValue({
      ...mockPractitioner,
      ...createDto,
      id: 'new-practitioner-uuid',
    });

    const result = await ctx.service.create(createDto);

    expect(result.userId).toBe(createDto.userId);
    expect(ctx.mockPrisma.practitioner.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: createDto.userId, specialty: createDto.specialty }),
      }),
    );
  });

  it('should create practitioner without price fields (pricing is per service)', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(null);
    ctx.mockPrisma.practitioner.create.mockResolvedValue(mockPractitioner);

    await ctx.service.create({ userId: mockUser.id, specialty: 'General' });

    expect(ctx.mockPrisma.practitioner.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: mockUser.id, specialty: 'General' }),
      }),
    );
  });

  it('should throw NotFoundException if user does not exist', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(ctx.service.create(createDto)).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException if user already has a practitioner record', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

    await expect(ctx.service.create(createDto)).rejects.toThrow(ConflictException);
  });
});

describe('PractitionersService — update', () => {
  let ctx: PractitionersTestContext;

  const updateDto = {
    bio: 'Updated bio text',
    bioAr: 'نص سيرة محدث',
    experience: 12,
  };

  beforeEach(async () => {
    ctx = await createPractitionersTestModule();
    jest.clearAllMocks();
  });

  it('should update practitioner fields', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitioner.update.mockResolvedValue({ ...mockPractitioner, ...updateDto });

    const result = await ctx.service.update(mockPractitioner.id, updateDto);

    expect(result.bio).toBe(updateDto.bio);
    expect(result.experience).toBe(updateDto.experience);
    expect(ctx.mockPrisma.practitioner.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockPractitioner.id },
        data: expect.objectContaining(updateDto),
      }),
    );
  });


  it('should throw NotFoundException if practitioner not found', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(null);

    await expect(ctx.service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
  });
});

describe('PractitionersService — softDelete', () => {
  let ctx: PractitionersTestContext;

  beforeEach(async () => {
    ctx = await createPractitionersTestModule();
    jest.clearAllMocks();
  });

  it('should set deletedAt timestamp', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitioner.update.mockResolvedValue({
      ...mockPractitioner,
      deletedAt: new Date(),
    });

    await ctx.service.delete(mockPractitioner.id);

    expect(ctx.mockPrisma.practitioner.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockPractitioner.id },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('should throw NotFoundException if practitioner not found', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(null);

    await expect(ctx.service.delete('non-existent-id')).rejects.toThrow(NotFoundException);
  });
});
