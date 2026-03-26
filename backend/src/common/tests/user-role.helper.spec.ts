/**
 * resolveUserRoleContext Helper Unit Tests
 */
import { resolveUserRoleContext } from '../helpers/user-role.helper.js';
import { PrismaService } from '../../database/prisma.service.js';

const userId = 'user-uuid-1';
const practitionerId = 'pract-uuid-1';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
  },
};

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: userId,
  userRoles: [],
  practitioner: null,
  ...overrides,
});

describe('resolveUserRoleContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return default context when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const ctx = await resolveUserRoleContext(mockPrisma as PrismaService, userId);

    expect(ctx.isAdmin).toBe(false);
    expect(ctx.isPractitioner).toBe(false);
    expect(ctx.practitionerId).toBeNull();
    expect(ctx.roles).toEqual([]);
  });

  it('should return isAdmin=true for super_admin role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeUser({
        userRoles: [{ role: { slug: 'super_admin' } }],
      }),
    );

    const ctx = await resolveUserRoleContext(mockPrisma as PrismaService, userId);

    expect(ctx.isAdmin).toBe(true);
    expect(ctx.roles).toContain('super_admin');
  });

  it('should return isAdmin=true for receptionist role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeUser({
        userRoles: [{ role: { slug: 'receptionist' } }],
      }),
    );

    const ctx = await resolveUserRoleContext(mockPrisma as PrismaService, userId);

    expect(ctx.isAdmin).toBe(true);
  });

  it('should return isPractitioner=true when active practitioner exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeUser({
        practitioner: { id: practitionerId, deletedAt: null },
      }),
    );

    const ctx = await resolveUserRoleContext(mockPrisma as PrismaService, userId);

    expect(ctx.isPractitioner).toBe(true);
    expect(ctx.practitionerId).toBe(practitionerId);
  });

  it('should return isPractitioner=false when practitioner is soft-deleted', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeUser({
        practitioner: { id: practitionerId, deletedAt: new Date() },
      }),
    );

    const ctx = await resolveUserRoleContext(mockPrisma as PrismaService, userId);

    expect(ctx.isPractitioner).toBe(false);
    expect(ctx.practitionerId).toBeNull();
  });

  it('should return both isAdmin and isPractitioner for admin practitioner', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeUser({
        userRoles: [{ role: { slug: 'super_admin' } }],
        practitioner: { id: practitionerId, deletedAt: null },
      }),
    );

    const ctx = await resolveUserRoleContext(mockPrisma as PrismaService, userId);

    expect(ctx.isAdmin).toBe(true);
    expect(ctx.isPractitioner).toBe(true);
  });

  it('should return patient role context', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeUser({
        userRoles: [{ role: { slug: 'patient' } }],
      }),
    );

    const ctx = await resolveUserRoleContext(mockPrisma as PrismaService, userId);

    expect(ctx.isAdmin).toBe(false);
    expect(ctx.isPractitioner).toBe(false);
    expect(ctx.roles).toContain('patient');
  });
});
