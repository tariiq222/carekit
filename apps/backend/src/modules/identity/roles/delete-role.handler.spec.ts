import { NotFoundException } from '@nestjs/common';
import { DeleteRoleHandler } from './delete-role.handler';

const buildPrisma = () => ({
  customRole: {
    findFirst: jest.fn().mockResolvedValue({ id: 'r-1' }),
    delete: jest.fn().mockResolvedValue({ id: 'r-1' }),
  },
  user: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
});

describe('DeleteRoleHandler', () => {
  it('clears users.customRoleId then deletes role atomically', async () => {
    const prisma = buildPrisma();
    await new DeleteRoleHandler(prisma as never).execute({ customRoleId: 'r-1' });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { customRoleId: 'r-1' },
      data: { customRoleId: null },
    });
    expect(prisma.customRole.delete).toHaveBeenCalledWith({ where: { id: 'r-1' } });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('throws NotFoundException when role not found', async () => {
    const prisma = buildPrisma();
    prisma.customRole.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      new DeleteRoleHandler(prisma as never).execute({ customRoleId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });
});
