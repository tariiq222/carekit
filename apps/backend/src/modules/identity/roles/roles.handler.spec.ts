import { CreateRoleHandler } from './create-role.handler';
import { AssignPermissionsHandler } from './assign-permissions.handler';
import { ListRolesHandler } from './list-roles.handler';

const buildRolesPrisma = () => ({
  customRole: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue({ id: 'role-1' }),
    create: jest.fn().mockResolvedValue({ id: 'role-1', name: 'Reception', permissions: [] }),
    findMany: jest.fn().mockResolvedValue([{ id: 'role-1', name: 'Reception', permissions: [] }]),
  },
  permission: {
    deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
});

describe('CreateRoleHandler — pure mock', () => {
  it('creates role successfully with organizationId from tenant context', async () => {
    const prisma = buildRolesPrisma();
    const tenant = buildTenant('org-A');
    const handler = new CreateRoleHandler(prisma as never, tenant as never);
    const result = await handler.execute({ name: 'Reception' });
    expect(prisma.customRole.findUnique).toHaveBeenCalledWith({
      where: { organizationId_name: { organizationId: 'org-A', name: 'Reception' } },
    });
    expect(prisma.customRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Reception', organizationId: 'org-A' }),
      }),
    );
    expect(result.id).toBe('role-1');
  });

  it('throws ConflictException for duplicate name within the same org', async () => {
    const prisma = buildRolesPrisma();
    const tenant = buildTenant('org-A');
    prisma.customRole.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'role-1', name: 'Reception' });
    const handler = new CreateRoleHandler(prisma as never, tenant as never);
    await expect(handler.execute({ name: 'Reception' })).rejects.toThrow('already exists');
  });

  it('allows the same role name when tenant context is a different org', async () => {
    const prismaOrgB = buildRolesPrisma();
    const tenantB = buildTenant('org-B');
    const handlerB = new CreateRoleHandler(prismaOrgB as never, tenantB as never);
    await expect(handlerB.execute({ name: 'Reception' })).resolves.toBeDefined();
    expect(prismaOrgB.customRole.findUnique).toHaveBeenCalledWith({
      where: { organizationId_name: { organizationId: 'org-B', name: 'Reception' } },
    });
  });
});

describe('AssignPermissionsHandler — pure mock', () => {
  it('deletes old permissions then creates new ones tagged with organizationId', async () => {
    const prisma = buildRolesPrisma();
    const tenant = buildTenant('org-A');
    const handler = new AssignPermissionsHandler(prisma as never, tenant as never);
    await handler.execute({
      customRoleId: 'role-1',
      permissions: [
        { action: 'read', subject: 'Booking' },
        { action: 'create', subject: 'Booking' },
      ],
    });
    expect(prisma.customRole.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'role-1', organizationId: 'org-A' }),
      }),
    );
    expect(prisma.permission.deleteMany).toHaveBeenCalledWith({ where: { customRoleId: 'role-1' } });
    expect(prisma.permission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ action: 'read', subject: 'Booking', organizationId: 'org-A' }),
        ]),
      }),
    );
  });

  it('handles empty permissions array (removes all)', async () => {
    const prisma = buildRolesPrisma();
    const tenant = buildTenant('org-A');
    const handler = new AssignPermissionsHandler(prisma as never, tenant as never);
    await handler.execute({ customRoleId: 'role-1', permissions: [] });
    expect(prisma.permission.deleteMany).toHaveBeenCalled();
    expect(prisma.permission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [] }),
    );
  });

  it('rejects when role belongs to a different org', async () => {
    const prisma = buildRolesPrisma();
    prisma.customRole.findFirst = jest.fn().mockResolvedValue(null);
    const tenant = buildTenant('org-B');
    const handler = new AssignPermissionsHandler(prisma as never, tenant as never);
    await expect(
      handler.execute({ customRoleId: 'role-1', permissions: [] }),
    ).rejects.toThrow(/not found/);
    expect(prisma.permission.createMany).not.toHaveBeenCalled();
  });
});

describe('ListRolesHandler', () => {
  it('returns roles scoped to the current org', async () => {
    const prisma = buildRolesPrisma();
    const tenant = buildTenant('org-A');
    const handler = new ListRolesHandler(prisma as never, tenant as never);
    const result = await handler.execute();
    expect(prisma.customRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-A' } }),
    );
    expect(Array.isArray(result)).toBe(true);
  });
});
