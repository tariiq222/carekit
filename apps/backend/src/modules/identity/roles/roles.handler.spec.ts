import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreateRoleHandler } from './create-role.handler';
import { AssignPermissionsHandler } from './assign-permissions.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('Roles handlers', () => {
  let createRole: CreateRoleHandler;
  let assignPerms: AssignPermissionsHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateRoleHandler,
        AssignPermissionsHandler,
        {
          provide: PrismaService,
          useValue: {
            customRole: { findUnique: jest.fn(), create: jest.fn() },
            permission: { deleteMany: jest.fn(), createMany: jest.fn() },
          },
        },
      ],
    }).compile();

    createRole = module.get(CreateRoleHandler);
    assignPerms = module.get(AssignPermissionsHandler);
    prisma = module.get(PrismaService);
  });

  it('creates a new custom role', async () => {
    prisma.customRole.findUnique.mockResolvedValue(null);
    prisma.customRole.create.mockResolvedValue({ id: 'role-1', name: 'Senior Receptionist' });
    const result = await createRole.execute({ tenantId: 'tenant-1', name: 'Senior Receptionist' });
    expect(result.id).toBe('role-1');
  });

  it('throws ConflictException for duplicate role name', async () => {
    prisma.customRole.findUnique.mockResolvedValue({ id: 'exists' });
    await expect(createRole.execute({ tenantId: 'tenant-1', name: 'Existing Role' })).rejects.toThrow(ConflictException);
  });

  it('replaces permissions for a role', async () => {
    prisma.permission.deleteMany.mockResolvedValue({ count: 1 });
    prisma.permission.createMany.mockResolvedValue({ count: 2 });
    await assignPerms.execute({
      tenantId: 'tenant-1',
      customRoleId: 'role-1',
      permissions: [{ action: 'create', subject: 'Booking' }, { action: 'read', subject: 'Client' }],
    });
    expect(prisma.permission.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: { customRoleId: 'role-1' } }));
    expect(prisma.permission.createMany).toHaveBeenCalled();
  });
});
