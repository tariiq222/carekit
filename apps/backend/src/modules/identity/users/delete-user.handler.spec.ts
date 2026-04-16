import { NotFoundException } from '@nestjs/common';
import { DeleteUserHandler } from './delete-user.handler';

const buildPrisma = () => ({
  user: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
});

describe('DeleteUserHandler', () => {
  it('deletes a user', async () => {
    const prisma = buildPrisma();
    await new DeleteUserHandler(prisma as never).execute({ userId: 'u-1' });
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({
      where: { id: 'u-1' },
    });
  });

  it('throws NotFoundException when user does not exist', async () => {
    const prisma = buildPrisma();
    prisma.user.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(
      new DeleteUserHandler(prisma as never).execute({ userId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });
});
