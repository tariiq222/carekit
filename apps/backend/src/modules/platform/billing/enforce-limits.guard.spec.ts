import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { PlanLimitsGuard } from './enforce-limits.guard';
import { startOfMonthUTC } from './usage-counter/period.util';

describe('PlanLimitsGuard', () => {
  const mockReflector = { get: jest.fn() };
  const mockPrisma = {
    branch: { count: jest.fn() },
    employee: { count: jest.fn() },
    booking: { count: jest.fn() },
  };
  const mockCache = { get: jest.fn() };
  const mockCounters = { read: jest.fn(), upsertExact: jest.fn() };
  const guard = new PlanLimitsGuard(
    mockReflector as never,
    mockPrisma as never,
    mockCache as never,
    mockCounters as never,
  );

  // Using a sentinel object avoids the JS default-param pitfall where
  // buildCtx(undefined) still triggers the default.
  // Callers use buildCtx() for happy-path, buildCtx(NO_USER) for missing-user,
  // and buildCtx({}) for user-without-organizationId.
  const NO_USER = { __noUser: true } as const;
  const buildCtx = (
    user: { organizationId?: string } | typeof NO_USER = { organizationId: 'org-1' },
  ) => {
    const resolved = (user as typeof NO_USER).__noUser === true ? undefined : user;
    return {
      getHandler: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: resolved }) }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows when no @EnforceLimit decorator (kind = undefined)', async () => {
    mockReflector.get.mockReturnValue(undefined);
    await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
    expect(mockCache.get).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when req.user is missing', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    await expect(guard.canActivate(buildCtx(NO_USER))).rejects.toThrow(UnauthorizedException);
    expect(mockCache.get).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when req.user has no organizationId', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    await expect(guard.canActivate(buildCtx({}))).rejects.toThrow(UnauthorizedException);
    expect(mockCache.get).not.toHaveBeenCalled();
  });

  it('allows when no subscription cached (returns true)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue(null);
    await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
  });

  it('throws ForbiddenException when subscription is CANCELED', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'CANCELED', limits: { maxBranches: 5 } });
    await expect(guard.canActivate(buildCtx())).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(buildCtx())).rejects.toThrow('Subscription is CANCELED');
  });

  it('throws ForbiddenException when subscription is SUSPENDED', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'SUSPENDED', limits: { maxBranches: 5 } });
    await expect(guard.canActivate(buildCtx())).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(buildCtx())).rejects.toThrow('Subscription is SUSPENDED');
  });

  it('allows when limit is -1 (unlimited)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBranches: -1 } });
    await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
    expect(mockPrisma.branch.count).not.toHaveBeenCalled();
  });

  it('allows when current < limit (count = 2, maxBranches = 3)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBranches: 3 } });
    mockPrisma.branch.count.mockResolvedValue(2);
    await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
  });

  it('throws ForbiddenException when current >= limit (count = 3, maxBranches = 3)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBranches: 3 } });
    mockPrisma.branch.count.mockResolvedValue(3);
    await expect(guard.canActivate(buildCtx())).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(buildCtx())).rejects.toThrow('Plan limit reached for BRANCHES: 3/3');
  });

  it('returns structured metadata when a plan limit is reached', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBranches: 3 } });
    mockPrisma.branch.count.mockResolvedValue(3);

    try {
      await guard.canActivate(buildCtx());
      throw new Error('Expected guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'PLAN_LIMIT_REACHED',
        limitKind: 'BRANCHES',
        current: 3,
        limit: 3,
        message: 'Plan limit reached for BRANCHES: 3/3',
      });
    }
  });

  it('EMPLOYEES counts only active employees', async () => {
    mockReflector.get.mockReturnValue('EMPLOYEES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxEmployees: 10 } });
    mockPrisma.employee.count.mockResolvedValue(5);
    await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
    expect(mockPrisma.employee.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', isActive: true },
    });
    expect(mockPrisma.branch.count).not.toHaveBeenCalled();
  });

  describe('BOOKINGS_PER_MONTH', () => {
    it('allows when monthly bookings counter is below the limit', async () => {
      mockReflector.get.mockReturnValue('BOOKINGS_PER_MONTH');
      mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBookingsPerMonth: 100 } });
      mockCounters.read.mockResolvedValue(50);
      await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
      expect(mockCounters.read).toHaveBeenCalledWith('org-1', FeatureKey.MONTHLY_BOOKINGS, startOfMonthUTC());
    });

    it('throws ForbiddenException when monthly bookings counter equals the limit', async () => {
      mockReflector.get.mockReturnValue('BOOKINGS_PER_MONTH');
      mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBookingsPerMonth: 100 } });
      mockCounters.read.mockResolvedValue(100);
      await expect(guard.canActivate(buildCtx())).rejects.toThrow('Plan limit reached for BOOKINGS_PER_MONTH: 100/100');
    });

    it('self-heals from source when counter row is missing', async () => {
      mockReflector.get.mockReturnValue('BOOKINGS_PER_MONTH');
      mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBookingsPerMonth: 100 } });
      mockCounters.read.mockResolvedValue(null);
      mockPrisma.booking.count.mockResolvedValue(7);
      await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
      expect(mockCounters.upsertExact).toHaveBeenCalledWith(
        'org-1',
        FeatureKey.MONTHLY_BOOKINGS,
        startOfMonthUTC(),
        7,
      );
    });

    it('allows when maxBookingsPerMonth is -1 (unlimited)', async () => {
      mockReflector.get.mockReturnValue('BOOKINGS_PER_MONTH');
      mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBookingsPerMonth: -1 } });
      await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
      expect(mockCounters.read).not.toHaveBeenCalled();
    });
  });

});

