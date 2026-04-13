import { NotFoundException } from '@nestjs/common';
import { DeleteUserHandler } from './delete-user.handler';

const buildPrisma = () => ({
  user: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
});

describe('DeleteUserHandler', () => {
  it('deletes a user scoped to tenant', async () => {
    const prisma = buildPrisma();
    await new DeleteUserHandler(prisma as never).execute({ userId: 'u-1', tenantId: 'tenant-1' });
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({
      where: { id: 'u-1', tenantId: 'tenant-1' },
    });
  });

  it('throws NotFoundException when user does not exist for tenant', async () => {
    const prisma = buildPrisma();
    prisma.user.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(
      new DeleteUserHandler(prisma as never).execute({ userId: 'missing', tenantId: 'tenant-1' }),
    ).rejects.toThrow(NotFoundException);
  });
});
