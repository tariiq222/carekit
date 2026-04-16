import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateServiceHandler } from './create-service.handler';
import { RecurringPatternDto } from './create-service.dto';
import { UpdateServiceHandler } from './update-service.handler';
import { ListServicesHandler } from './list-services.handler';
import { ArchiveServiceHandler } from './archive-service.handler';
import { SetDurationOptionsHandler } from './set-duration-options.handler';
import { SetEmployeeServiceOptionsHandler } from './set-employee-service-options.handler';

const mockService = {
  id: 'svc-1',
  nameAr: 'قص الشعر',
  nameEn: 'Haircut',
  descriptionAr: null,
  descriptionEn: null,
  categoryId: null,
  durationMins: 30,
  price: '50.00',
  currency: 'SAR',
  imageUrl: null,
  isActive: true,
  isHidden: false,
  hidePriceOnBooking: false,
  hideDurationOnBooking: false,
  iconName: null,
  iconBgColor: null,
  bufferMinutes: 0,
  minLeadMinutes: null,
  maxAdvanceDays: null,
  depositEnabled: false,
  depositAmount: null,
  allowRecurring: false,
  allowedRecurringPatterns: [],
  maxRecurrences: null,
  minParticipants: 1,
  maxParticipants: 1,
  reserveWithoutPayment: false,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: null,
  durationOptions: [],
};

const buildPrisma = () => ({
  service: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockService),
    update: jest.fn().mockResolvedValue(mockService),
    findMany: jest.fn().mockResolvedValue([mockService]),
    count: jest.fn().mockResolvedValue(1),
  },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
});

describe('CreateServiceHandler', () => {
  it('creates service when name is unique', async () => {
    const prisma = buildPrisma();
    const handler = new CreateServiceHandler(prisma as never);
    const result = await handler.execute({ nameAr: 'قص الشعر', durationMins: 30, price: 50 });
    expect(result.id).toBe('svc-1');
  });

  it('throws ConflictException when name already exists', async () => {
    const prisma = buildPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue(mockService);
    const handler = new CreateServiceHandler(prisma as never);
    await expect(
      handler.execute({ nameAr: 'قص الشعر', durationMins: 30, price: 50 }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when depositAmount exceeds price', async () => {
    const prisma = buildPrisma();
    const handler = new CreateServiceHandler(prisma as never);
    await expect(
      handler.execute({
        nameAr: 'خدمة جديدة',
        durationMins: 30,
        price: 100,
        depositEnabled: true,
        depositAmount: 150,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when minParticipants > maxParticipants', async () => {
    const prisma = buildPrisma();
    const handler = new CreateServiceHandler(prisma as never);
    await expect(
      handler.execute({
        nameAr: 'جلسة جماعية',
        durationMins: 60,
        price: 100,
        minParticipants: 10,
        maxParticipants: 5,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when reserveWithoutPayment is true but maxParticipants = 1', async () => {
    const prisma = buildPrisma();
    const handler = new CreateServiceHandler(prisma as never);
    await expect(
      handler.execute({
        nameAr: 'خدمة فردية',
        durationMins: 30,
        price: 100,
        maxParticipants: 1,
        reserveWithoutPayment: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates group session service successfully', async () => {
    const prisma = buildPrisma();
    const handler = new CreateServiceHandler(prisma as never);
    const result = await handler.execute({
      nameAr: 'يوغا جماعية',
      durationMins: 60,
      price: 100,
      minParticipants: 3,
      maxParticipants: 10,
      reserveWithoutPayment: true,
    });
    expect(result.id).toBe('svc-1');
  });

  it('creates recurring service successfully', async () => {
    const prisma = buildPrisma();
    const handler = new CreateServiceHandler(prisma as never);
    const result = await handler.execute({
      nameAr: 'علاج أسبوعي',
      durationMins: 45,
      price: 200,
      allowRecurring: true,
      allowedRecurringPatterns: [RecurringPatternDto.WEEKLY, RecurringPatternDto.BIWEEKLY],
      maxRecurrences: 12,
    });
    expect(result.id).toBe('svc-1');
  });
});

describe('UpdateServiceHandler', () => {
  it('updates service when found', async () => {
    const prisma = buildPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue(mockService);
    const handler = new UpdateServiceHandler(prisma as never);
    const result = await handler.execute({ serviceId: 'svc-1', durationMins: 45 });
    expect(result).toEqual(mockService);
  });

  it('throws NotFoundException when service not found', async () => {
    const prisma = buildPrisma();
    const handler = new UpdateServiceHandler(prisma as never);
    await expect(
      handler.execute({ serviceId: 'missing', durationMins: 45 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when depositAmount would exceed updated price', async () => {
    const prisma = buildPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue({ ...mockService, depositEnabled: true, depositAmount: '80.00' });
    const handler = new UpdateServiceHandler(prisma as never);
    await expect(
      handler.execute({ serviceId: 'svc-1', price: 50 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when minParticipants would exceed maxParticipants', async () => {
    const prisma = buildPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue({ ...mockService, maxParticipants: 5 });
    const handler = new UpdateServiceHandler(prisma as never);
    await expect(
      handler.execute({ serviceId: 'svc-1', minParticipants: 10 }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ListServicesHandler', () => {
  it('returns paginated services with meta', async () => {
    const prisma = buildPrisma();
    const handler = new ListServicesHandler(prisma as never);
    const result = await handler.execute({});
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it('filters by isActive', async () => {
    const prisma = buildPrisma();
    const handler = new ListServicesHandler(prisma as never);
    await handler.execute({ isActive: true });
    const callArgs = prisma.service.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArgs.where.isActive).toBe(true);
  });

  it('excludes hidden services by default', async () => {
    const prisma = buildPrisma();
    const handler = new ListServicesHandler(prisma as never);
    await handler.execute({});
    const callArgs = prisma.service.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArgs.where.isHidden).toBe(false);
  });

  it('includes hidden services when includeHidden = true', async () => {
    const prisma = buildPrisma();
    const handler = new ListServicesHandler(prisma as never);
    await handler.execute({ includeHidden: true });
    const callArgs = prisma.service.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArgs.where.isHidden).toBeUndefined();
  });

  it('filters by categoryId', async () => {
    const prisma = buildPrisma();
    const handler = new ListServicesHandler(prisma as never);
    await handler.execute({ categoryId: 'cat-1' });
    const callArgs = prisma.service.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArgs.where.categoryId).toBe('cat-1');
  });

  it('adds search OR clause when search is provided', async () => {
    const prisma = buildPrisma();
    const handler = new ListServicesHandler(prisma as never);
    await handler.execute({ search: 'قص' });
    const callArgs = prisma.service.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArgs.where.OR).toBeDefined();
  });
});

describe('ArchiveServiceHandler', () => {
  it('archives service when found', async () => {
    const prisma = buildPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue(mockService);
    const handler = new ArchiveServiceHandler(prisma as never);
    const result = await handler.execute({ serviceId: 'svc-1' });
    expect(result).toEqual(mockService);
  });

  it('throws NotFoundException when service not found', async () => {
    const prisma = buildPrisma();
    const handler = new ArchiveServiceHandler(prisma as never);
    await expect(
      handler.execute({ serviceId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SetDurationOptionsHandler', () => {
  const buildServicesPrisma = () => ({
    service: { findFirst: jest.fn().mockResolvedValue({ id: 'svc-1' }) },
    serviceDurationOption: {
      update: jest.fn().mockResolvedValue({ id: 'opt-1' }),
      create: jest.fn().mockResolvedValue({ id: 'opt-new' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'opt-1' }]),
    },
    employeeServiceOption: {
      upsert: jest.fn().mockResolvedValue({ id: 'eso-1' }),
    },
    $transaction: jest.fn().mockImplementation(
      (ops: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)) =>
        typeof ops === 'function' ? ops({
          serviceDurationOption: { update: jest.fn().mockResolvedValue({ id: 'opt-1' }), create: jest.fn().mockResolvedValue({ id: 'opt-new' }) },
          employeeServiceOption: { upsert: jest.fn().mockResolvedValue({ id: 'eso-1' }) },
        }) : Promise.all(ops),
    ),
  });

  it('throws NotFoundException when service not found', async () => {
    const prisma = buildServicesPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new SetDurationOptionsHandler(prisma as never);
    await expect(handler.execute({
      serviceId: 'bad', options: [],
    })).rejects.toThrow('not found');
  });

  it('creates new options when id is not provided', async () => {
    const prisma = buildServicesPrisma();
    const handler = new SetDurationOptionsHandler(prisma as never);
    await handler.execute({
      serviceId: 'svc-1',
      options: [{ durationMins: 60, price: 200, currency: 'SAR', label: '60 min', labelAr: '٦٠ دقيقة' }],
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('updates existing options when id is provided', async () => {
    const prisma = buildServicesPrisma();
    const handler = new SetDurationOptionsHandler(prisma as never);
    await handler.execute({
      serviceId: 'svc-1',
      options: [{ id: 'opt-1', durationMins: 45, price: 150, currency: 'SAR', label: '45 min', labelAr: '٤٥ دقيقة' }],
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe('SetEmployeeServiceOptionsHandler', () => {
  const buildServicesPrisma = () => ({
    service: { findFirst: jest.fn().mockResolvedValue({ id: 'svc-1' }) },
    serviceDurationOption: {
      findMany: jest.fn().mockResolvedValue([{ id: 'opt-1' }]),
    },
    employeeServiceOption: {
      upsert: jest.fn().mockResolvedValue({ id: 'eso-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation(
      (ops: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)) =>
        typeof ops === 'function' ? ops({
          serviceDurationOption: { findMany: jest.fn().mockResolvedValue([{ id: 'opt-1' }]) },
          employeeServiceOption: { upsert: jest.fn().mockResolvedValue({ id: 'eso-1' }) },
        }) : Promise.all(ops),
    ),
  });

  it('throws NotFoundException when durationOptionId not found', async () => {
    const prisma = buildServicesPrisma();
    prisma.serviceDurationOption.findMany = jest.fn().mockResolvedValue([]);
    const handler = new SetEmployeeServiceOptionsHandler(prisma as never);
    await expect(handler.execute({
      employeeServiceId: 'es-1',
      options: [{ durationOptionId: 'bad-opt' }],
    })).rejects.toThrow('not found');
  });

  it('upserts employee service options', async () => {
    const prisma = buildServicesPrisma();
    const handler = new SetEmployeeServiceOptionsHandler(prisma as never);
    await handler.execute({
      employeeServiceId: 'es-1',
      options: [{ durationOptionId: 'opt-1', priceOverride: 300 }],
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
