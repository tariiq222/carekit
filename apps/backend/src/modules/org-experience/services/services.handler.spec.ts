import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateServiceHandler } from './create-service.handler';
import { UpdateServiceHandler } from './update-service.handler';
import { ListServicesHandler } from './list-services.handler';
import { ArchiveServiceHandler } from './archive-service.handler';

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
