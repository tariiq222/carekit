/**
 * checkOwnership Helper Unit Tests
 */
import { ForbiddenException } from '@nestjs/common';
import { checkOwnership } from '../helpers/ownership.helper.js';
import { PrismaService } from '../../database/prisma.service.js';

const ownerUserId = 'owner-uuid-1';
const currentUserId = 'current-uuid-1';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
  },
};

describe('checkOwnership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass without DB query when owner equals current user', async () => {
    await expect(
      checkOwnership(mockPrisma as PrismaService, ownerUserId, ownerUserId),
    ).resolves.not.toThrow();

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when user has no admin role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      userRoles: [{ role: { slug: 'patient' } }],
    });

    await expect(
      checkOwnership(mockPrisma as PrismaService, ownerUserId, currentUserId),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should pass when current user is super_admin', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      userRoles: [{ role: { slug: 'super_admin' } }],
    });

    await expect(
      checkOwnership(mockPrisma as PrismaService, ownerUserId, currentUserId),
    ).resolves.not.toThrow();
  });

  it('should pass when current user is receptionist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      userRoles: [{ role: { slug: 'receptionist' } }],
    });

    await expect(
      checkOwnership(mockPrisma as PrismaService, ownerUserId, currentUserId),
    ).resolves.not.toThrow();
  });

  it('should throw ForbiddenException when user not found in DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      checkOwnership(mockPrisma as PrismaService, ownerUserId, currentUserId),
    ).rejects.toThrow(ForbiddenException);
  });
});
