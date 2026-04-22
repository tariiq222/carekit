import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtGuard } from './jwt.guard';

const makeCtx = (handler: object, cls: object) =>
  ({
    getHandler: () => handler,
    getClass: () => cls,
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

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtGuard(reflector, prisma as never, redis as never);
    prisma.organization.findUnique.mockReset();
    redisClient.get.mockReset();
    redisClient.set.mockReset();
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
      new UnauthorizedException('ORG_SUSPENDED'),
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
      new UnauthorizedException('ORG_SUSPENDED'),
    );
    expect(redisClient.set).toHaveBeenCalledWith(
      'org-suspension:org-1',
      suspendedAt.toISOString(),
      'EX',
      30,
    );
  });
});
