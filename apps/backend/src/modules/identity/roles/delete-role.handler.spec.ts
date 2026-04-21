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

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
});

describe('DeleteRoleHandler', () => {
  it('clears users.customRoleId then deletes role atomically', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant('org-A');
    await new DeleteRoleHandler(prisma as never, tenant as never).execute({ customRoleId: 'r-1' });
    expect(prisma.customRole.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'r-1', organizationId: 'org-A' }),
      }),
    );
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
      new DeleteRoleHandler(prisma as never, buildTenant() as never).execute({ customRoleId: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when role belongs to a different org', async () => {
    const prisma = buildPrisma();
    // findFirst with { id, organizationId } mismatch returns null.
    prisma.customRole.findFirst = jest.fn().mockResolvedValue(null);
    const tenant = buildTenant('org-B');
    await expect(
      new DeleteRoleHandler(prisma as never, tenant as never).execute({ customRoleId: 'r-1' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.customRole.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'r-1', organizationId: 'org-B' }),
      }),
    );
  });
});
