import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { AttachMembershipHandler } from './attach-membership.handler';

describe('AttachMembershipHandler', () => {
  let handler: AttachMembershipHandler;

  const orgId = '11111111-1111-1111-1111-111111111111';

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
    },
    membership: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockTenant = {
    requireOrganizationIdOrDefault: jest.fn().mockReturnValue(orgId),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachMembershipHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantContextService, useValue: mockTenant },
      ],
    }).compile();

    handler = module.get<AttachMembershipHandler>(AttachMembershipHandler);
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('throws NotFoundException when user is not found by phone', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        handler.execute({
          identifier: '+966501234567',
          role: 'EMPLOYEE',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { phone: '+966501234567' },
      });
    });

    it('throws NotFoundException when user is not found by email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        handler.execute({
          identifier: 'user@example.com',
          role: 'EMPLOYEE',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });

    it('throws ConflictException when membership already exists', async () => {
      const user = { id: 'user-1' };
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockPrisma.membership.findFirst.mockResolvedValue({ id: 'existing-membership' });

      await expect(
        handler.execute({
          identifier: '+966501234567',
          role: 'EMPLOYEE',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates membership successfully', async () => {
      const user = { id: 'user-1' };
      const membership = {
        id: 'membership-1',
        userId: user.id,
        organizationId: orgId,
        role: 'EMPLOYEE',
        isActive: true,
        acceptedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockPrisma.membership.findFirst.mockResolvedValue(null);
      mockPrisma.membership.create.mockResolvedValue(membership);

      const result = await handler.execute({
        identifier: '+966501234567',
        role: 'EMPLOYEE',
      });

      expect(result).toEqual(membership);
      expect(mockPrisma.membership.create).toHaveBeenCalledWith({
        data: {
          userId: user.id,
          organizationId: orgId,
          role: 'EMPLOYEE',
          isActive: true,
        },
      });
    });
  });
});