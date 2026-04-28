import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../infrastructure/database';
import { CaslAbilityFactory } from './casl/casl-ability.factory';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('secret-key') } },
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
        { provide: CaslAbilityFactory, useValue: { buildForUser: jest.fn().mockReturnValue({ rules: [] }) } },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
    prisma = module.get(PrismaService);
  });

  it('returns enriched user object for valid payload', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', role: 'ADMIN',
      customRoleId: null, customRole: null, isActive: true,
    } as never);

    const result = await strategy.validate({ sub: 'u1', email: 'a@b.com', role: 'ADMIN', customRoleId: null, permissions: [], features: [] });
    expect(result.id).toBe('u1');
    expect(result.permissions).toBeDefined();
  });

  it('throws UnauthorizedException when user not found or inactive', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com', role: 'ADMIN', customRoleId: null, permissions: [], features: [] }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('propagates organizationId and membershipId when present in payload', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', role: 'ADMIN',
      customRoleId: null, customRole: null, isActive: true,
    } as never);

    const result = await strategy.validate({
      sub: 'u1', email: 'a@b.com', role: 'ADMIN',
      customRoleId: null, permissions: [], features: [],
      organizationId: 'org-1', membershipId: 'mem-1',
    });
    expect(result.organizationId).toBe('org-1');
    expect(result.membershipId).toBe('mem-1');
    expect(result.isSuperAdmin).toBe(false);
  });

  it('treats missing tenant claims as undefined (backward compat)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', role: 'ADMIN',
      customRoleId: null, customRole: null, isActive: true,
    } as never);

    const result = await strategy.validate({
      sub: 'u1', email: 'a@b.com', role: 'ADMIN',
      customRoleId: null, permissions: [], features: [],
    });
    expect(result.organizationId).toBeUndefined();
    expect(result.membershipId).toBeUndefined();
    expect(result.isSuperAdmin).toBe(false);
  });

  it('exposes both `id` and `sub` (P0: 36 controller usages of user.sub depend on this)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-7', email: 'a@b.com', role: 'ADMIN',
      customRoleId: null, customRole: null, isActive: true,
    } as never);

    const result = await strategy.validate({
      sub: 'u-7', email: 'a@b.com', role: 'ADMIN',
      customRoleId: null, permissions: [], features: [],
    });

    expect(result.id).toBe('u-7');
    // Without `sub`, controllers reading `user.sub` (admin/organizations,
    // admin/impersonation, mobile/employee/*) write `superAdminUserId: undefined`
    // into audit rows — making the audit log unreliable.
    expect((result as { sub?: string }).sub).toBe('u-7');
  });

  it('marks isSuperAdmin true when the DB user has role SUPER_ADMIN', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'sa@b.com', role: 'SUPER_ADMIN',
      customRoleId: null, customRole: null, isActive: true,
    } as never);

    const result = await strategy.validate({
      sub: 'u1', email: 'sa@b.com', role: 'SUPER_ADMIN',
      customRoleId: null, permissions: [], features: [],
    });
    expect(result.isSuperAdmin).toBe(true);
  });
});
