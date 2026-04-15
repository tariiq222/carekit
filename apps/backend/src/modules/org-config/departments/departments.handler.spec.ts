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
  },
  $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises as unknown as unknown[])),
});

describe('CreateDepartmentHandler', () => {
  it('creates a department', async () => {
    const prisma = buildPrisma();
    prisma.department.findFirst = jest.fn().mockResolvedValue(null); // no duplicate
    const handler = new CreateDepartmentHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', nameAr: 'عيادة', nameEn: 'Clinic' });
    expect(prisma.department.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
    expect(result).toMatchObject({ id: 'dept-1' });
  });

  it('throws ConflictException on duplicate nameAr', async () => {
    const prisma = buildPrisma();
    // findFirst returns existing dept (duplicate)
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
    expect(prisma.department.update).toHaveBeenCalled();
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.department.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new UpdateDepartmentHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', departmentId: 'bad', nameEn: 'x' })).rejects.toThrow(NotFoundException);
  });
});
