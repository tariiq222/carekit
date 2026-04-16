import { NotFoundException } from '@nestjs/common';
import { AssignRoleHandler } from './assign-role.handler';

const buildPrisma = () => ({
  customRole: { findFirst: jest.fn().mockResolvedValue({ id: 'r-1' }) },
  user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
});

describe('AssignRoleHandler', () => {
  it('assigns customRoleId to user', async () => {
    const prisma = buildPrisma();
    await new AssignRoleHandler(prisma as never).execute({
      userId: 'u-1', customRoleId: 'r-1',
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { customRoleId: 'r-1' },
    });
  });

  it('throws NotFoundException when role not found', async () => {
    const prisma = buildPrisma();
    prisma.customRole.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      new AssignRoleHandler(prisma as never).execute({
        userId: 'u-1', customRoleId: 'missing',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when user does not exist', async () => {
    const prisma = buildPrisma();
    prisma.user.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(
      new AssignRoleHandler(prisma as never).execute({
        userId: 'missing', customRoleId: 'r-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
