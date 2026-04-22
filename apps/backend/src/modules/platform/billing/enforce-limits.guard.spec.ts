import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlanLimitsGuard } from './enforce-limits.guard';

describe('PlanLimitsGuard', () => {
  const mockReflector = { get: jest.fn() };
  const mockPrisma = { branch: { count: jest.fn() }, employee: { count: jest.fn() } };
  const mockTenant = { requireOrganizationId: jest.fn().mockReturnValue('org-1') };
  const mockCache = { get: jest.fn() };
  const guard = new PlanLimitsGuard(
    mockReflector as never,
    mockPrisma as never,
    mockTenant as never,
    mockCache as never,
  );

  const mockCtx = { getHandler: () => ({}) } as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTenant.requireOrganizationId.mockReturnValue('org-1');
  });

  it('allows when no @EnforceLimit decorator (kind = undefined)', async () => {
    mockReflector.get.mockReturnValue(undefined);
    await expect(guard.canActivate(mockCtx)).resolves.toBe(true);
    expect(mockCache.get).not.toHaveBeenCalled();
  });

  it('allows when no subscription cached (returns true)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue(null);
    await expect(guard.canActivate(mockCtx)).resolves.toBe(true);
  });

  it('throws ForbiddenException when subscription is CANCELED', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'CANCELED', limits: { maxBranches: 5 } });
    await expect(guard.canActivate(mockCtx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(mockCtx)).rejects.toThrow('Subscription is CANCELED');
  });

  it('throws ForbiddenException when subscription is SUSPENDED', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'SUSPENDED', limits: { maxBranches: 5 } });
    await expect(guard.canActivate(mockCtx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(mockCtx)).rejects.toThrow('Subscription is SUSPENDED');
  });

  it('allows when limit is -1 (unlimited)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBranches: -1 } });
    await expect(guard.canActivate(mockCtx)).resolves.toBe(true);
    expect(mockPrisma.branch.count).not.toHaveBeenCalled();
  });

  it('allows when current < limit (count = 2, maxBranches = 3)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBranches: 3 } });
    mockPrisma.branch.count.mockResolvedValue(2);
    await expect(guard.canActivate(mockCtx)).resolves.toBe(true);
  });

  it('throws ForbiddenException when current >= limit (count = 3, maxBranches = 3)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBranches: 3 } });
    mockPrisma.branch.count.mockResolvedValue(3);
    await expect(guard.canActivate(mockCtx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(mockCtx)).rejects.toThrow('Plan limit reached for BRANCHES: 3/3');
  });

  it('EMPLOYEES uses employee.count not branch.count', async () => {
    mockReflector.get.mockReturnValue('EMPLOYEES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxEmployees: 10 } });
    mockPrisma.employee.count.mockResolvedValue(5);
    await expect(guard.canActivate(mockCtx)).resolves.toBe(true);
    expect(mockPrisma.employee.count).toHaveBeenCalledWith({ where: { organizationId: 'org-1' } });
    expect(mockPrisma.branch.count).not.toHaveBeenCalled();
  });
});
