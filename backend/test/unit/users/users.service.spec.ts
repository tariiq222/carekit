/**
 * CareKit — UsersService Unit Tests (TDD RED Phase)
 *
 * Tests the UsersService business logic in isolation:
 *   - CRUD operations (findAll, findOne, create, update, softDelete)
 *   - Pagination, filtering, and search
 *   - Activation / deactivation
 *   - Role management
 *
 * Dependencies mocked: PrismaService, password hashing.
 * These tests will FAIL until backend-dev implements UsersService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../../../src/modules/users/users.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { UserRolesService } from '../../../src/modules/users/user-roles.service.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';
import { PractitionersService } from '../../../src/modules/practitioners/practitioners.service.js';
import { AuthCacheService } from '../../../src/modules/auth/auth-cache.service.js';
import { CreateUserDto, UpdateUserDto } from '../../../src/modules/users/dto/create-user.dto.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaService: any = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  role: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  userRole: {
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  practitioner: {
    create: jest.fn(),
  },
  specialty: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockPrismaService)),
};

const mockUserRolesService = {
  assignRole: jest.fn().mockResolvedValue(undefined),
  removeRole: jest.fn().mockResolvedValue(undefined),
};

const mockActivityLogService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockPractitionersService = {
  createForUser: jest.fn().mockResolvedValue(undefined),
};

const mockAuthCacheService = {
  invalidate: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UserRolesService, useValue: mockUserRolesService },
        { provide: ActivityLogService, useValue: mockActivityLogService },
        { provide: PractitionersService, useValue: mockPractitionersService },
        { provide: AuthCacheService, useValue: mockAuthCacheService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // =========================================================================
  // findAll
  // =========================================================================

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        { id: 'u1', email: 'a@test.com', firstName: 'أحمد', lastName: 'أ', isActive: true },
        { id: 'u2', email: 'b@test.com', firstName: 'سارة', lastName: 'ب', isActive: true },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, perPage: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(20);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(false);
    });

    it('should filter by role', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.findAll({ role: 'patient' });

      const findCall = mockPrismaService.user.findMany.mock.calls[0][0];
      // Should include role filter in where clause
      expect(findCall.where).toBeDefined();
      expect(JSON.stringify(findCall.where)).toContain('patient');
    });

    it('should filter by isActive status', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.findAll({ isActive: false });

      const findCall = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(findCall.where.isActive).toBe(false);
    });

    it('should search by name or email (case-insensitive)', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.findAll({ search: 'ahmed' });

      const findCall = mockPrismaService.user.findMany.mock.calls[0][0];
      // Should use OR with contains for firstName, lastName, email
      expect(findCall.where.OR).toBeDefined();
      expect(Array.isArray(findCall.where.OR)).toBe(true);
    });

    it('should exclude soft-deleted users by default', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.findAll({});

      const findCall = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(findCall.where.deletedAt).toBeNull();
    });

    it('should apply correct pagination offset', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(50);

      await service.findAll({ page: 3, perPage: 10 });

      const findCall = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(findCall.skip).toBe(20); // (3-1) * 10
      expect(findCall.take).toBe(10);
    });
  });

  // =========================================================================
  // findOne
  // =========================================================================

  describe('findOne', () => {
    it('should return user with roles and permissions', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@test.com',
        firstName: 'خالد',
        lastName: 'الفهد',
        isActive: true,
        emailVerified: true,
        deletedAt: null,
        userRoles: [
          {
            role: {
              slug: 'receptionist',
              rolePermissions: [
                { permission: { module: 'bookings', action: 'view' } },
              ],
            },
          },
        ],
      });

      const result = await service.findOne('user-id');

      expect(result.id).toBe('user-id');
      expect(result.email).toBe('user@test.com');
      expect(result.roles).toEqual(expect.arrayContaining([expect.objectContaining({ slug: 'receptionist' })]));
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for soft-deleted user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'deleted-id',
        deletedAt: new Date(),
      });

      await expect(service.findOne('deleted-id')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // create
  // =========================================================================

  describe('create', () => {
    const createDto: CreateUserDto = {
      email: 'new@clinic.com',
      password: 'Str0ngP@ss!',
      firstName: 'جديد',
      lastName: 'المستخدم',
      phone: '+966531234567',
      gender: 'male',
      roleSlug: 'receptionist',
    };

    it('should create user and assign specified role', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null); // no duplicate
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'rec-role-id',
        slug: 'receptionist',
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-id',
        email: createDto.email,
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        isActive: true,
        emailVerified: false,
      });
      mockPrismaService.userRole.create.mockResolvedValue({});

      const result = await service.create(createDto);

      expect(result.id).toBeDefined();
      expect(result.email).toBe(createDto.email);
      expect(mockPrismaService.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roleId: 'rec-role-id',
          }),
        }),
      );
    });

    it('should hash password', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'role-id',
        slug: 'receptionist',
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-id',
        email: createDto.email,
      });
      mockPrismaService.userRole.create.mockResolvedValue({});

      await service.create(createDto);

      const createCall = mockPrismaService.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).toBeDefined();
      expect(createCall.data.passwordHash).not.toBe(createDto.password);
      expect(createCall.data).not.toHaveProperty('password');
    });

    it('should delegate practitioner profile creation to PractitionersService', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'prac-role-id',
        slug: 'practitioner',
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'prac-user-id',
        email: 'prac@clinic.com',
      });
      mockPrismaService.userRole.create.mockResolvedValue({});

      await service.create({ ...createDto, roleSlug: 'practitioner' });

      // Should delegate to PractitionersService, not directly use Prisma
      expect(mockPractitionersService.createForUser).toHaveBeenCalledWith('prac-user-id');
      expect(mockPrismaService.practitioner.create).not.toHaveBeenCalled();
    });

    it('should not call PractitionersService for non-practitioner roles', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'rec-role-id',
        slug: 'receptionist',
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-id',
        email: createDto.email,
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        isActive: true,
        emailVerified: false,
      });
      mockPrismaService.userRole.create.mockResolvedValue({});

      await service.create(createDto);

      expect(mockPractitionersService.createForUser).not.toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'existing-id',
        email: createDto.email,
      });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should normalize email to lowercase', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'role-id',
        slug: 'receptionist',
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'id',
        email: 'upper@clinic.com',
      });
      mockPrismaService.userRole.create.mockResolvedValue({});

      await service.create({ ...createDto, email: 'UPPER@CLINIC.COM' });

      const createCall = mockPrismaService.user.create.mock.calls[0][0];
      expect(createCall.data.email).toBe('upper@clinic.com');
    });
  });

  // =========================================================================
  // update
  // =========================================================================

  describe('update', () => {
    it('should update allowed fields', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'old@test.com',
        deletedAt: null,
      });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-id',
        email: 'old@test.com',
        firstName: 'جديد',
        lastName: 'الاسم',
      });

      const result = await service.update('user-id', {
        firstName: 'جديد',
        lastName: 'الاسم',
      });

      expect(result.firstName).toBe('جديد');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-id' },
          data: expect.objectContaining({
            firstName: 'جديد',
            lastName: 'الاسم',
          }),
        }),
      );
    });

    it('should not update password through this method', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        deletedAt: null,
      });
      mockPrismaService.user.update.mockResolvedValue({ id: 'user-id' });

      await service.update('user-id', { firstName: 'test' } as UpdateUserDto);

      const updateCall = mockPrismaService.user.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('password');
      expect(updateCall.data).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictException if email already taken', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'old@test.com',
        deletedAt: null,
      });
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'other-id',
        email: 'taken@test.com',
      });

      await expect(
        service.update('user-id', { email: 'taken@test.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { firstName: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // softDelete
  // =========================================================================

  describe('softDelete', () => {
    it('should set deletedAt timestamp', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'target-id',
        deletedAt: null,
      });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'target-id',
        deletedAt: new Date(),
      });

      await service.softDelete('target-id', 'admin-id');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target-id' },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should not physically delete the record', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'target-id',
        deletedAt: null,
      });
      mockPrismaService.user.update.mockResolvedValue({});

      await service.softDelete('target-id', 'admin-id');

      // Should use update, not delete
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should throw if trying to delete own account', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'admin-id',
        deletedAt: null,
      });

      await expect(
        service.softDelete('admin-id', 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.softDelete('nonexistent', 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // activate / deactivate
  // =========================================================================

  describe('activate', () => {
    it('should set isActive to true', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        isActive: false,
        deletedAt: null,
      });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-id',
        isActive: true,
      });

      const result = await service.activate('user-id');

      expect(result.isActive).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-id' },
          data: { isActive: true },
        }),
      );
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        isActive: true,
        deletedAt: null,
      });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-id',
        isActive: false,
      });

      const result = await service.deactivate('user-id', 'admin-id');

      expect(result.isActive).toBe(false);
    });

    it('should throw if trying to deactivate own account', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'admin-id',
        isActive: true,
        deletedAt: null,
      });

      await expect(
        service.deactivate('admin-id', 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

});
