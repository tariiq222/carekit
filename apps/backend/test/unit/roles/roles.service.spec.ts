/**
 * RolesService Unit Tests
 * Covers: findAll, findOne, create, delete, assignPermission, removePermission
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RolesService } from '../../../src/modules/roles/roles.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { AuthCacheService } from '../../../src/modules/auth/auth-cache.service.js';

function createMockPrisma() {
  return {
    role: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
    },
    permission: {
      findUnique: jest.fn(),
    },
    rolePermission: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

function createMockAuthCache() {
  return {
    invalidate: jest.fn().mockResolvedValue(undefined),
  };
}

const mockRoleId = 'role-uuid-001';
const mockPermissionId = 'perm-uuid-001';
const mockUserId = 'user-uuid-001';

const mockPermission = {
  id: mockPermissionId,
  module: 'bookings',
  action: 'create',
};

const mockRole = {
  id: mockRoleId,
  name: 'Manager',
  slug: 'manager',
  description: 'Clinic manager',
  isSystem: false,
  isDefault: false,
  createdAt: new Date('2024-01-01'),
  rolePermissions: [{ permission: mockPermission }],
};

const mockSystemRole = {
  ...mockRole,
  id: 'system-role-id',
  slug: 'admin',
  isSystem: true,
};

const mockRolePermission = {
  roleId: mockRoleId,
  permissionId: mockPermissionId,
  permission: mockPermission,
};

async function createModule(
  mockPrisma: ReturnType<typeof createMockPrisma>,
  mockAuthCache: ReturnType<typeof createMockAuthCache>,
) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RolesService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: AuthCacheService, useValue: mockAuthCache },
    ],
  }).compile();
  return module.get<RolesService>(RolesService);
}

describe('RolesService — findAll', () => {
  let service: RolesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma, createMockAuthCache());
    jest.clearAllMocks();
  });

  it('should return all roles with permissions', async () => {
    mockPrisma.role.findMany.mockResolvedValue([mockRole]);

    const result = await service.findAll();

    expect(result).toEqual([mockRole]);
    expect(mockPrisma.role.findMany).toHaveBeenCalledWith({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { createdAt: 'asc' },
    });
  });
});

describe('RolesService — findOne', () => {
  let service: RolesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma, createMockAuthCache());
    jest.clearAllMocks();
  });

  it('should return role by id', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(mockRole);

    const result = await service.findOne(mockRoleId);

    expect(result).toEqual(mockRole);
    expect(mockPrisma.role.findUnique).toHaveBeenCalledWith({
      where: { id: mockRoleId },
      include: { rolePermissions: { include: { permission: true } } },
    });
  });

  it('should throw NotFoundException when role not found', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);

    await expect(service.findOne('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('RolesService — create', () => {
  let service: RolesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma, createMockAuthCache());
    jest.clearAllMocks();
  });

  it('should auto-generate slug from name', async () => {
    const dto = { name: 'Clinic Manager', description: 'Manages clinic' };
    mockPrisma.role.findUnique.mockResolvedValue(null);
    mockPrisma.role.create.mockResolvedValue({
      ...mockRole,
      name: 'Clinic Manager',
      slug: 'clinic_manager',
    });

    const result = await service.create(dto);

    expect(mockPrisma.role.findUnique).toHaveBeenCalledWith({
      where: { slug: 'clinic_manager' },
    });
    expect(mockPrisma.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'clinic_manager',
          isSystem: false,
          isDefault: false,
        }),
      }),
    );
    expect(result.slug).toBe('clinic_manager');
  });

  it('should use provided slug if given', async () => {
    const dto = {
      name: 'Clinic Manager',
      slug: 'custom_slug',
      description: 'Manages clinic',
    };
    mockPrisma.role.findUnique.mockResolvedValue(null);
    mockPrisma.role.create.mockResolvedValue({
      ...mockRole,
      slug: 'custom_slug',
    });

    await service.create(dto);

    expect(mockPrisma.role.findUnique).toHaveBeenCalledWith({
      where: { slug: 'custom_slug' },
    });
    expect(mockPrisma.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'custom_slug' }),
      }),
    );
  });

  it('should throw ConflictException when slug already exists', async () => {
    const dto = { name: 'Manager', description: 'Duplicate role' };
    mockPrisma.role.findUnique.mockResolvedValue(mockRole);

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    expect(mockPrisma.role.create).not.toHaveBeenCalled();
  });
});

describe('RolesService — delete', () => {
  let service: RolesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockAuthCache: ReturnType<typeof createMockAuthCache>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockAuthCache = createMockAuthCache();
    service = await createModule(mockPrisma, mockAuthCache);
    jest.clearAllMocks();
  });

  it('should delete role and invalidate cache for affected users', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(mockRole);
    mockPrisma.userRole.findMany.mockResolvedValue([{ userId: mockUserId }]);
    mockPrisma.role.delete.mockResolvedValue(mockRole);

    const result = await service.delete(mockRoleId);

    expect(result).toEqual({ deleted: true });
    expect(mockPrisma.role.delete).toHaveBeenCalledWith({
      where: { id: mockRoleId },
    });
    expect(mockAuthCache.invalidate).toHaveBeenCalledWith(mockUserId);
  });

  it('should throw NotFoundException when role not found', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);

    await expect(service.delete('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.role.delete).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException when trying to delete system role', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(mockSystemRole);

    await expect(service.delete(mockSystemRole.id)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.role.delete).not.toHaveBeenCalled();
  });
});

describe('RolesService — assignPermission', () => {
  let service: RolesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockAuthCache: ReturnType<typeof createMockAuthCache>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockAuthCache = createMockAuthCache();
    service = await createModule(mockPrisma, mockAuthCache);
    jest.clearAllMocks();
  });

  it('should assign permission to role', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(mockRole);
    mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
    mockPrisma.rolePermission.findUnique.mockResolvedValue(null);
    mockPrisma.rolePermission.create.mockResolvedValue(mockRolePermission);
    mockPrisma.userRole.findMany.mockResolvedValue([{ userId: mockUserId }]);

    const result = await service.assignPermission(
      mockRoleId,
      'bookings',
      'create',
    );

    expect(result).toEqual(mockRolePermission);
    expect(mockPrisma.rolePermission.create).toHaveBeenCalledWith({
      data: { roleId: mockRoleId, permissionId: mockPermissionId },
      include: { permission: true },
    });
    expect(mockAuthCache.invalidate).toHaveBeenCalledWith(mockUserId);
  });

  it('should return existing assignment without creating duplicate', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(mockRole);
    mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
    mockPrisma.rolePermission.findUnique.mockResolvedValue(mockRolePermission);

    const result = await service.assignPermission(
      mockRoleId,
      'bookings',
      'create',
    );

    expect(result).toEqual(mockRolePermission);
    expect(mockPrisma.rolePermission.create).not.toHaveBeenCalled();
    expect(mockAuthCache.invalidate).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when role not found', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);

    await expect(
      service.assignPermission('bad-id', 'bookings', 'create'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should allow permission assignment even for system roles (only deletion/rename is restricted)', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(mockSystemRole);
    mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
    mockPrisma.rolePermission.findUnique.mockResolvedValue(null);
    mockPrisma.rolePermission.create.mockResolvedValue({
      ...mockPermission,
      roleId: mockSystemRole.id,
    });
    mockPrisma.userRole.findMany.mockResolvedValue([]);

    // System roles CAN have permissions modified — no exception expected
    await expect(
      service.assignPermission(mockSystemRole.id, 'bookings', 'create'),
    ).resolves.toBeDefined();
  });

  it('should throw NotFoundException when permission not found', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(mockRole);
    mockPrisma.permission.findUnique.mockResolvedValue(null);

    await expect(
      service.assignPermission(mockRoleId, 'bookings', 'nonexistent'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('RolesService — removePermission', () => {
  let service: RolesService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockAuthCache: ReturnType<typeof createMockAuthCache>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockAuthCache = createMockAuthCache();
    service = await createModule(mockPrisma, mockAuthCache);
    jest.clearAllMocks();
  });

  it('should remove permission and invalidate cache', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(mockRole);
    mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
    mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.userRole.findMany.mockResolvedValue([{ userId: mockUserId }]);

    const result = await service.removePermission(
      mockRoleId,
      'bookings',
      'create',
    );

    expect(result).toEqual({ deleted: true });
    expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: mockRoleId, permissionId: mockPermissionId },
    });
    expect(mockAuthCache.invalidate).toHaveBeenCalledWith(mockUserId);
  });

  it('should allow permission removal even for system roles (only deletion/rename is restricted)', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(mockSystemRole);
    mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
    mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.userRole.findMany.mockResolvedValue([]);

    // System roles CAN have permissions removed — no exception expected
    const result = await service.removePermission(
      mockSystemRole.id,
      'bookings',
      'create',
    );
    expect(result).toEqual({ deleted: true });
    expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalled();
  });
});
