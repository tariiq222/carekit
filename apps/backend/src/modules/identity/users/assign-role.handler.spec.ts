import { NotFoundException } from '@nestjs/common';
import { AssignRoleHandler } from './assign-role.handler';

const buildPrisma = () => ({
  customRole: { findFirst: jest.fn().mockResolvedValue({ id: 'r-1' }) },
  user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
});

describe('AssignRoleHandler', () => {
  it('assigns customRoleId to user scoped to tenant', async () => {
    const prisma = buildPrisma();
    await new AssignRoleHandler(prisma as never).execute({
      tenantId: 'tenant-1', userId: 'u-1', customRoleId: 'r-1',
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u-1', tenantId: 'tenant-1' },
      data: { customRoleId: 'r-1' },
    });
  });

  it('throws NotFoundException when role does not belong to tenant', async () => {
    const prisma = buildPrisma();
    prisma.customRole.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      new AssignRoleHandler(prisma as never).execute({
        tenantId: 'tenant-1', userId: 'u-1', customRoleId: 'missing',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when user does not exist for tenant', async () => {
    const prisma = buildPrisma();
    prisma.user.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(
      new AssignRoleHandler(prisma as never).execute({
        tenantId: 'tenant-1', userId: 'missing', customRoleId: 'r-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
