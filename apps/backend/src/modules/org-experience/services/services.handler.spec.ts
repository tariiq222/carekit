import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateServiceHandler } from './create-service.handler';
import { UpdateServiceHandler } from './update-service.handler';
import { ListServicesHandler } from './list-services.handler';
import { ArchiveServiceHandler } from './archive-service.handler';
import { SetDurationOptionsHandler } from './set-duration-options.handler';
import { SetEmployeeServiceOptionsHandler } from './set-employee-service-options.handler';

const mockService = {
  id: 'svc-1',
  tenantId: 'tenant-1',
  nameAr: 'قص الشعر',
  nameEn: 'Haircut',
  descriptionAr: null,
  descriptionEn: null,
  durationMins: 30,
  price: '50.00',
  currency: 'SAR',
  imageUrl: null,
  isActive: true,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
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
    const result = await handler.execute({ tenantId: 'tenant-1', nameAr: 'قص الشعر', durationMins: 30, price: 50 });
    expect(result.id).toBe('svc-1');
  });

  it('throws ConflictException when name already exists', async () => {
    const prisma = buildPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue(mockService);
    const handler = new CreateServiceHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-1', nameAr: 'قص الشعر', durationMins: 30, price: 50 }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('UpdateServiceHandler', () => {
  it('updates service when found', async () => {
    const prisma = buildPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue(mockService);
    const handler = new UpdateServiceHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', serviceId: 'svc-1', durationMins: 45 });
    expect(result).toEqual(mockService);
  });

  it('throws NotFoundException when service not found', async () => {
    const prisma = buildPrisma();
    const handler = new UpdateServiceHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-1', serviceId: 'missing', durationMins: 45 }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ListServicesHandler', () => {
  it('returns paginated services excluding archived', async () => {
    const prisma = buildPrisma();
    const handler = new ListServicesHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1' });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});

describe('ArchiveServiceHandler', () => {
  it('archives service when found', async () => {
    const prisma = buildPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue(mockService);
    const handler = new ArchiveServiceHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', serviceId: 'svc-1' });
    expect(result).toEqual(mockService);
  });

  it('throws NotFoundException when service not found', async () => {
    const prisma = buildPrisma();
    const handler = new ArchiveServiceHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-1', serviceId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SetDurationOptionsHandler', () => {
  const buildServicesPrisma = () => ({
    service: { findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', tenantId: 'tenant-1' }) },
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
      tenantId: 'tenant-1', serviceId: 'bad', options: [],
    })).rejects.toThrow('not found');
  });

  it('creates new options when id is not provided', async () => {
    const prisma = buildServicesPrisma();
    const handler = new SetDurationOptionsHandler(prisma as never);
    await handler.execute({
      tenantId: 'tenant-1',
      serviceId: 'svc-1',
      options: [{ durationMins: 60, price: 200, currency: 'SAR', label: '60 min', labelAr: '٦٠ دقيقة' }],
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('updates existing options when id is provided', async () => {
    const prisma = buildServicesPrisma();
    const handler = new SetDurationOptionsHandler(prisma as never);
    await handler.execute({
      tenantId: 'tenant-1',
      serviceId: 'svc-1',
      options: [{ id: 'opt-1', durationMins: 45, price: 150, currency: 'SAR', label: '45 min', labelAr: '٤٥ دقيقة' }],
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe('SetEmployeeServiceOptionsHandler', () => {
  const buildServicesPrisma = () => ({
    service: { findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', tenantId: 'tenant-1' }) },
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

  it('throws NotFoundException when durationOptionId not found for tenant', async () => {
    const prisma = buildServicesPrisma();
    prisma.serviceDurationOption.findMany = jest.fn().mockResolvedValue([]);
    const handler = new SetEmployeeServiceOptionsHandler(prisma as never);
    await expect(handler.execute({
      tenantId: 'tenant-1',
      employeeServiceId: 'es-1',
      options: [{ durationOptionId: 'bad-opt' }],
    })).rejects.toThrow('not found');
  });

  it('upserts employee service options', async () => {
    const prisma = buildServicesPrisma();
    const handler = new SetEmployeeServiceOptionsHandler(prisma as never);
    await handler.execute({
      tenantId: 'tenant-1',
      employeeServiceId: 'es-1',
      options: [{ durationOptionId: 'opt-1', priceOverride: 300 }],
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
