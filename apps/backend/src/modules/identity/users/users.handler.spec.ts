import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserHandler } from './create-user.handler';
import { DeactivateUserHandler } from './deactivate-user.handler';
import { ListUsersHandler } from './list-users.handler';
import { UpdateUserHandler } from './update-user.handler';

const buildUsersPrisma = () => ({
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: 'u-1', name: 'Ahmad', isActive: true }),
    create: jest.fn().mockResolvedValue({ id: 'u-1', email: 'a@clinic.sa', name: 'Ahmad' }),
    update: jest.fn().mockResolvedValue({ id: 'u-1', name: 'Updated', isActive: false }),
    findMany: jest.fn().mockResolvedValue([{ id: 'u-1' }]),
    count: jest.fn().mockResolvedValue(1),
  },
});

describe('CreateUserHandler', () => {
  it('creates user with hashed password', async () => {
    const prisma = buildUsersPrisma();
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    const passwordService = { hash: jest.fn().mockResolvedValue('hashed') };
    const handler = new CreateUserHandler(prisma as never, passwordService as never);
    const result = await handler.execute({
      email: 'a@b.com', password: 'pass123', name: 'Ali', role: 'RECEPTIONIST' as never,
    });
    expect(result.id).toBe('u-1');
  });

  it('throws ConflictException when email already taken', async () => {
    const prisma = buildUsersPrisma();
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'existing' });
    const passwordService = { hash: jest.fn().mockResolvedValue('hashed') };
    const handler = new CreateUserHandler(prisma as never, passwordService as never);
    await expect(
      handler.execute({ email: 'a@b.com', password: 'pass', name: 'Ali', role: 'RECEPTIONIST' as never }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('DeactivateUserHandler', () => {
  it('deactivates user', async () => {
    const prisma = buildUsersPrisma();
    const handler = new DeactivateUserHandler(prisma as never);
    await handler.execute({ userId: 'u-1' });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
  });

  it('throws NotFoundException when user not found', async () => {
    const prisma = buildUsersPrisma();
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    const handler = new DeactivateUserHandler(prisma as never);
    await expect(handler.execute({ userId: 'u-1' })).rejects.toThrow(NotFoundException);
  });
});

describe('ListUsersHandler', () => {
  it('returns paginated users', async () => {
    const prisma = buildUsersPrisma();
    const tenantCtx = { requireOrganizationId: jest.fn().mockReturnValue('org-1') };
    const handler = new ListUsersHandler(prisma as never, tenantCtx as never);
    const result = await handler.execute({ page: 1, limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});

describe('UpdateUserHandler', () => {
  it('updates user fields', async () => {
    const prisma = buildUsersPrisma();
    const handler = new UpdateUserHandler(prisma as never);
    await handler.execute({ userId: 'u-1', name: 'New Name' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1' }, data: expect.objectContaining({ name: 'New Name' }) }),
    );
  });

  it('throws NotFoundException when user not found', async () => {
    const prisma = buildUsersPrisma();
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    const handler = new UpdateUserHandler(prisma as never);
    await expect(handler.execute({ userId: 'bad' })).rejects.toThrow('not found');
  });
});

describe('ListUsersHandler — filters', () => {
  it('applies search filter to name and email', async () => {
    const prisma = buildUsersPrisma();
    const tenantCtx = { requireOrganizationId: jest.fn().mockReturnValue('org-1') };
    const handler = new ListUsersHandler(prisma as never, tenantCtx as never);
    await handler.execute({ page: 1, limit: 10, search: 'ahmad' });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.arrayContaining([expect.objectContaining({ name: expect.anything() })]) }),
      }),
    );
  });

  it('returns paginated meta', async () => {
    const prisma = buildUsersPrisma();
    const tenantCtx = { requireOrganizationId: jest.fn().mockReturnValue('org-1') };
    const handler = new ListUsersHandler(prisma as never, tenantCtx as never);
    const result = await handler.execute({ page: 1, limit: 10 });
    expect(result.meta).toMatchObject({ total: 1, page: 1, perPage: 10, totalPages: 1 });
  });
});

describe('ListUsersHandler — tenant scoping (P0)', () => {
  it('filters users by current tenant via Membership relation', async () => {
    const prisma = buildUsersPrisma();
    const tenantCtx = { requireOrganizationId: jest.fn().mockReturnValue('org-A') };
    const handler = new ListUsersHandler(prisma as never, tenantCtx as never);
    await handler.execute({ page: 1, limit: 10 });
    expect(tenantCtx.requireOrganizationId).toHaveBeenCalled();
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberships: { some: { organizationId: 'org-A', isActive: true } },
        }),
      }),
    );
    expect(prisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberships: { some: { organizationId: 'org-A', isActive: true } },
        }),
      }),
    );
  });

  it('throws when no tenant context (strict mode)', async () => {
    const prisma = buildUsersPrisma();
    const tenantCtx = {
      requireOrganizationId: jest.fn().mockImplementation(() => {
        throw new Error('UnauthorizedTenantAccess');
      }),
    };
    const handler = new ListUsersHandler(prisma as never, tenantCtx as never);
    await expect(handler.execute({ page: 1, limit: 10 })).rejects.toThrow('UnauthorizedTenantAccess');
  });
});
