import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateDepartmentHandler } from './create-department.handler';
import { ListDepartmentsHandler } from './list-departments.handler';
import { UpdateDepartmentHandler } from './update-department.handler';

const mockDept = { id: 'dept-1', tenantId: 'tenant-1', nameAr: 'عيادة', nameEn: 'Clinic', sortOrder: 0, isActive: true, isVisible: true, categories: [] };

const buildPrisma = () => ({
  department: {
    create: jest.fn().mockResolvedValue(mockDept),
    findMany: jest.fn().mockResolvedValue([mockDept]),
    count: jest.fn().mockResolvedValue(1),
    findFirst: jest.fn().mockResolvedValue(mockDept),
    update: jest.fn().mockResolvedValue(mockDept),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises as unknown as unknown[])),
});

describe('CreateDepartmentHandler', () => {
  it('creates a department and passes all fields to prisma', async () => {
    const prisma = buildPrisma();
    const handler = new CreateDepartmentHandler(prisma as never);
    const result = await handler.execute({
      tenantId: 'tenant-1',
      nameAr: 'عيادة',
      nameEn: 'Clinic',
      descriptionAr: 'وصف القسم',
      descriptionEn: 'Department description',
      icon: 'clinic-icon',
    });
    expect(prisma.department.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        nameAr: 'عيادة',
        descriptionAr: 'وصف القسم',
        descriptionEn: 'Department description',
        icon: 'clinic-icon',
      }),
    });
    expect(result).toMatchObject({ id: 'dept-1' });
  });

  it('throws ConflictException on duplicate nameAr (P2002)', async () => {
    const { Prisma } = await import('@prisma/client');
    const prisma = buildPrisma();
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '5.0.0' },
    );
    prisma.department.create = jest.fn().mockRejectedValue(p2002);
    const handler = new CreateDepartmentHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-1', nameAr: 'عيادة' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('ListDepartmentsHandler', () => {
  it('returns departments scoped to tenant', async () => {
    const prisma = buildPrisma();
    const handler = new ListDepartmentsHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', page: 1, limit: 10 });
    expect(result.items).toHaveLength(1);
  });
});

describe('UpdateDepartmentHandler', () => {
  it('updates department fields', async () => {
    const prisma = buildPrisma();
    const handler = new UpdateDepartmentHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1', departmentId: 'dept-1', nameEn: 'Updated' });
    expect(prisma.department.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dept-1', tenantId: 'tenant-1' },
      }),
    );
  });

  it('throws NotFoundException when department not found or wrong tenant', async () => {
    const prisma = buildPrisma();
    prisma.department.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const handler = new UpdateDepartmentHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-2', departmentId: 'dept-1', nameEn: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });
});
