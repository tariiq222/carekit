import { ConflictException } from '@nestjs/common';
import { CreateRoleHandler } from './create-role.handler';
import { AssignPermissionsHandler } from './assign-permissions.handler';
import { ListRolesHandler } from './list-roles.handler';

const buildRolesPrisma = () => ({
  customRole: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'role-1', name: 'Reception', tenantId: 'tenant-1', permissions: [] }),
    findMany: jest.fn().mockResolvedValue([{ id: 'role-1', name: 'Reception', permissions: [] }]),
  },
  permission: {
    deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
});

describe('CreateRoleHandler — pure mock', () => {
  it('creates role successfully', async () => {
    const prisma = buildRolesPrisma();
    const handler = new CreateRoleHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', name: 'Reception' });
    expect(prisma.customRole.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1', name: 'Reception' }) }),
    );
    expect(result.id).toBe('role-1');
  });

  it('throws ConflictException for duplicate name', async () => {
    const prisma = buildRolesPrisma();
    prisma.customRole.findUnique = jest.fn().mockResolvedValue({ id: 'role-1', name: 'Reception' });
    const handler = new CreateRoleHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', name: 'Reception' })).rejects.toThrow('already exists');
  });
});

describe('AssignPermissionsHandler — pure mock', () => {
  it('deletes old permissions then creates new ones', async () => {
    const prisma = buildRolesPrisma();
    const handler = new AssignPermissionsHandler(prisma as never);
    await handler.execute({
      tenantId: 'tenant-1',
      customRoleId: 'role-1',
      permissions: [
        { action: 'read', subject: 'Booking' },
        { action: 'create', subject: 'Booking' },
      ],
    });
    expect(prisma.permission.deleteMany).toHaveBeenCalledWith({ where: { customRoleId: 'role-1' } });
    expect(prisma.permission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ action: 'read', subject: 'Booking', tenantId: 'tenant-1' }),
        ]),
      }),
    );
  });

  it('handles empty permissions array (removes all)', async () => {
    const prisma = buildRolesPrisma();
    const handler = new AssignPermissionsHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1', customRoleId: 'role-1', permissions: [] });
    expect(prisma.permission.deleteMany).toHaveBeenCalled();
    expect(prisma.permission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [] }),
    );
  });
});

describe('ListRolesHandler', () => {
  it('returns roles scoped to tenant', async () => {
    const prisma = buildRolesPrisma();
    const handler = new ListRolesHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1' });
    expect(prisma.customRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: { tenantId: 'tenant-1' } }) }),
    );
    expect(Array.isArray(result)).toBe(true);
  });
});