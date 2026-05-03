import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtGuard } from './jwt.guard';

const makeCtx = (handler: object, cls: object, req: object = {}) =>
  ({
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  }) as unknown as ExecutionContext;

describe('JwtGuard', () => {
  let reflector: Reflector;
  let guard: JwtGuard;
  const prisma = {
    organization: {
      findUnique: jest.fn(),
    },
  };
  const redisClient = {
    get: jest.fn(),
    set: jest.fn(),
  };
  const redis = {
    getClient: jest.fn(() => redisClient),
  };
  const tenantContext = {
    set: jest.fn(),
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtGuard(reflector, prisma as never, redis as never, tenantContext as never);
    prisma.organization.findUnique.mockReset();
    redis.getClient.mockReset();
    redis.getClient.mockImplementation(() => redisClient);
    redisClient.get.mockReset();
    redisClient.set.mockReset();
    tenantContext.set.mockReset();
  });

  it('returns true for public routes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    await expect(guard.canActivate(makeCtx({}, {}))).resolves.toBe(true);
  });

  it('handleRequest returns user when token is valid', () => {
    const user = { id: 'u-1' };
    expect(guard.handleRequest(null, user, null, {} as ExecutionContext)).toBe(user);
  });

  it('handleRequest throws UnauthorizedException when no user', () => {
    expect(() =>
      guard.handleRequest(null, null as never, null, {} as ExecutionContext),
    ).toThrow(UnauthorizedException);
  });

  it('handleRequest throws UnauthorizedException when error present', () => {
    expect(() =>
      guard.handleRequest(new Error('fail'), null as never, null, {} as ExecutionContext),
    ).toThrow(UnauthorizedException);
  });

  it('stamps TenantContext after JWT validation', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const passportCanActivate = jest
      .spyOn(Object.getPrototypeOf(JwtGuard.prototype), 'canActivate')
      .mockResolvedValue(true);
    redisClient.get.mockResolvedValue('active');

    const ctx = makeCtx(
      {},
      {},
      {
        user: {
          id: 'user-1',
          organizationId: 'org-1',
          membershipId: 'member-1',
          role: 'ADMIN',
          isSuperAdmin: false,
        },
      },
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(tenantContext.set).toHaveBeenCalledWith({
      organizationId: 'org-1',
      membershipId: 'member-1',
      id: 'user-1',
      role: 'ADMIN',
      isSuperAdmin: false,
    });

    passportCanActivate.mockRestore();
  });

  it('skips suspension lookup when no organizationId is present', async () => {
    await expect(guard.assertOrganizationIsActive(undefined)).resolves.toBeUndefined();
    expect(redis.getClient).not.toHaveBeenCalled();
  });

  it('allows when Redis says the organization is active', async () => {
    redisClient.get.mockResolvedValue('active');

    await expect(guard.assertOrganizationIsActive('org-1')).resolves.toBeUndefined();
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when Redis cache says the organization is suspended', async () => {
    redisClient.get.mockResolvedValue('2026-04-22T10:00:00.000Z');

    await expect(guard.assertOrganizationIsActive('org-1')).rejects.toThrow(
      'ORG_SUSPENDED',
    );
  });

  it('caches active org state for 30 seconds on a cache miss', async () => {
    redisClient.get.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue({ suspendedAt: null });

    await expect(guard.assertOrganizationIsActive('org-1')).resolves.toBeUndefined();
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      select: { suspendedAt: true },
    });
    expect(redisClient.set).toHaveBeenCalledWith('org-suspension:org-1', 'active', 'EX', 30);
  });

  it('caches suspended org state and rejects on a cache miss', async () => {
    const suspendedAt = new Date('2026-04-22T10:00:00.000Z');
    redisClient.get.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue({ suspendedAt });

    await expect(guard.assertOrganizationIsActive('org-1')).rejects.toThrow(
      'ORG_SUSPENDED',
    );
    expect(redisClient.set).toHaveBeenCalledWith(
      'org-suspension:org-1',
      suspendedAt.toISOString(),
      'EX',
      30,
    );
  });

  // ─── Bug B10 — @AllowDuringSuspension recovery decorator ─────────────────
  describe('Bug B10: @AllowDuringSuspension recovery exemption', () => {
    it('rejects suspended org by default (no decorator)', async () => {
      redisClient.get.mockResolvedValue('2026-04-22T10:00:00.000Z');
      await expect(
        guard.assertOrganizationIsActive('org-1'),
      ).rejects.toThrow('ORG_SUSPENDED');
    });

    it('allows suspended org when @AllowDuringSuspension AND user is OWNER', async () => {
      redisClient.get.mockResolvedValue('2026-04-22T10:00:00.000Z');
      await expect(
        guard.assertOrganizationIsActive('org-1', {
          allowDuringSuspension: true,
          membershipRole: 'OWNER',
        }),
      ).resolves.toBeUndefined();
    });

    it('rejects suspended org when @AllowDuringSuspension but user is not OWNER (e.g. RECEPTIONIST)', async () => {
      redisClient.get.mockResolvedValue('2026-04-22T10:00:00.000Z');
      await expect(
        guard.assertOrganizationIsActive('org-1', {
          allowDuringSuspension: true,
          membershipRole: 'RECEPTIONIST',
        }),
      ).rejects.toThrow('ORG_SUSPENDED');
    });

    it('rejects suspended org when @AllowDuringSuspension but membershipRole missing', async () => {
      redisClient.get.mockResolvedValue('2026-04-22T10:00:00.000Z');
      await expect(
        guard.assertOrganizationIsActive('org-1', {
          allowDuringSuspension: true,
        }),
      ).rejects.toThrow('ORG_SUSPENDED');
    });

    it('rejects suspended org for OWNER when decorator absent', async () => {
      redisClient.get.mockResolvedValue('2026-04-22T10:00:00.000Z');
      await expect(
        guard.assertOrganizationIsActive('org-1', {
          allowDuringSuspension: false,
          membershipRole: 'OWNER',
        }),
      ).rejects.toThrow('ORG_SUSPENDED');
    });

    it('rejection includes bilingual recovery hint', async () => {
      redisClient.get.mockResolvedValue('2026-04-22T10:00:00.000Z');
      try {
        await guard.assertOrganizationIsActive('org-1');
        fail('expected to throw');
      } catch (err) {
        const ex = err as UnauthorizedException;
        const body = ex.getResponse() as {
          code?: string;
          recoveryHint?: { ar?: string; en?: string };
        };
        expect(body.code).toBe('ORG_SUSPENDED');
        expect(body.recoveryHint?.ar).toContain('معلّق');
        expect(body.recoveryHint?.en).toContain('suspended');
      }
    });

    it('cached-suspension path also honors recovery exemption', async () => {
      // Cache is hot with a suspendedAt timestamp; verify the decorator path
      // still bypasses for OWNER without re-querying Postgres.
      redisClient.get.mockResolvedValue('2026-04-22T10:00:00.000Z');
      await expect(
        guard.assertOrganizationIsActive('org-1', {
          allowDuringSuspension: true,
          membershipRole: 'OWNER',
        }),
      ).resolves.toBeUndefined();
      expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    });
  });
});
