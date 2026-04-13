import { NotFoundException } from '@nestjs/common';
import { RemoveRoleHandler } from './remove-role.handler';

const buildPrisma = () => ({
  user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
});

describe('RemoveRoleHandler', () => {
  it('clears customRoleId only when user actually has that role', async () => {
    const prisma = buildPrisma();
    await new RemoveRoleHandler(prisma as never).execute({
      tenantId: 'tenant-1', userId: 'u-1', customRoleId: 'r-1',
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u-1', tenantId: 'tenant-1', customRoleId: 'r-1' },
      data: { customRoleId: null },
    });
  });

  it('throws NotFoundException when user does not have the role assigned', async () => {
    const prisma = buildPrisma();
    prisma.user.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(
      new RemoveRoleHandler(prisma as never).execute({
        tenantId: 'tenant-1', userId: 'u-1', customRoleId: 'r-2',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
