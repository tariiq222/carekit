/**
 * UserRolesService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRolesService } from '../user-roles.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { AuthCacheService } from '../../auth/auth-cache.service.js';

const userId = 'user-uuid-1';
const roleId = 'role-uuid-1';
const mockUser = { id: userId, deletedAt: null };
const mockRole = { id: roleId, slug: 'staff' };
const mockUserRole = { id: 'ur-uuid-1', userId, roleId };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: { findUnique: jest.fn() },
  role: { findUnique: jest.fn() },
  userRole: {
    findFirst: jest.fn(),
    create: jest.fn().mockResolvedValue(mockUserRole),
    delete: jest.fn().mockResolvedValue(mockUserRole),
    count: jest.fn(),
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAuthCache: any = {
  invalidate: jest.fn().mockResolvedValue(undefined),
};

describe('UserRolesService', () => {
  let service: UserRolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRolesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthCacheService, useValue: mockAuthCache },
      ],
    }).compile();

    service = module.get<UserRolesService>(UserRolesService);
    jest.clearAllMocks();
  });

  describe('assignRole', () => {
    it('should assign a role to a user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.userRole.findFirst.mockResolvedValue(null);

      await service.assignRole(userId, roleId);

      expect(mockPrisma.userRole.create).toHaveBeenCalledWith({
        data: { userId, roleId },
      });
      expect(mockAuthCache.invalidate).toHaveBeenCalledWith(userId);
    });

    it('should return early if role already assigned (idempotent)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.userRole.findFirst.mockResolvedValue(mockUserRole);

      await service.assignRole(userId, roleId);

      expect(mockPrisma.userRole.create).not.toHaveBeenCalled();
      expect(mockAuthCache.invalidate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.assignRole('non-existent', roleId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user is soft-deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      await expect(service.assignRole(userId, roleId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when role not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(service.assignRole(userId, 'non-existent-role')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeRole', () => {
    it('should remove a role from a user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userRole.findFirst.mockResolvedValue(mockUserRole);
      mockPrisma.userRole.count.mockResolvedValue(2);

      await service.removeRole(userId, roleId);

      expect(mockPrisma.userRole.delete).toHaveBeenCalledWith({ where: { id: mockUserRole.id } });
      expect(mockAuthCache.invalidate).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.removeRole('non-existent', roleId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when role assignment not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userRole.findFirst.mockResolvedValue(null);

      await expect(service.removeRole(userId, roleId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when removing last role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userRole.findFirst.mockResolvedValue(mockUserRole);
      mockPrisma.userRole.count.mockResolvedValue(1);

      await expect(service.removeRole(userId, roleId)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.userRole.delete).not.toHaveBeenCalled();
    });
  });
});
