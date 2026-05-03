import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { ScheduleDowngradeHandler } from './schedule-downgrade.handler';
import { DowngradePrecheckFailedException } from '../downgrade-safety/downgrade-precheck.exception';

const periodEnd = new Date('2026-05-01T00:00:00.000Z');
const basicPlan = { id: 'plan-basic', priceMonthly: '300.00', priceAnnual: '3000.00', limits: { maxEmployees: 5 } };
const proPlan = { id: 'plan-pro', priceMonthly: '900.00', priceAnnual: '9000.00', limits: { maxEmployees: 20 } };

const buildPrisma = () => ({
  subscription: { findFirst: jest.fn(), update: jest.fn() },
  plan: { findFirst: jest.fn() },
});

const buildTenant = () => ({
  requireOrganizationId: jest.fn().mockReturnValue('org-A'),
});

const buildCache = () => ({ invalidate: jest.fn() });

const buildSafety = (
  result: { ok: boolean; violations: Array<{ kind: string; current: number; targetMax: number }> } = { ok: true, violations: [] },
) => ({
  checkDowngrade: jest.fn().mockResolvedValue(result),
});

const buildHandler = (
  prisma: ReturnType<typeof buildPrisma>,
  cache = buildCache(),
  safety: ReturnType<typeof buildSafety> = buildSafety(),
) =>
  new ScheduleDowngradeHandler(
    prisma as never,
    buildTenant() as never,
    cache as never,
    safety as never,
  );

describe('ScheduleDowngradeHandler', () => {
  it('rejects equal or higher target price for the requested cycle', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodEnd: periodEnd,
      plan: basicPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-pro', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('stores scheduled plan fields at currentPeriodEnd without changing planId', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      planId: 'plan-pro',
      plan: proPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    prisma.subscription.update.mockResolvedValue({
      id: 'sub-1',
      planId: 'plan-pro',
      scheduledPlanId: 'plan-basic',
    });
    const cache = buildCache();
    const handler = buildHandler(prisma, cache);

    const result = await handler.execute({ planId: 'plan-basic', billingCycle: 'MONTHLY' });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({
        scheduledPlanId: 'plan-basic',
        scheduledBillingCycle: 'MONTHLY',
        scheduledPlanChangeAt: periodEnd,
      }),
    });
    expect(prisma.subscription.update.mock.calls[0][0].data).not.toHaveProperty('planId');
    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
    expect(result).toMatchObject({ scheduledPlanId: 'plan-basic' });
  });

  it('clears scheduled cancellation when scheduling a downgrade for active continuation', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true,
      planId: 'plan-pro',
      plan: proPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1' });
    const handler = buildHandler(prisma);

    await handler.execute({ planId: 'plan-basic', billingCycle: 'MONTHLY' });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({
        cancelAtPeriodEnd: false,
        scheduledCancellationDate: null,
      }),
    });
  });

  it('throws NotFoundException when no subscription exists', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(null);
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-basic', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws DowngradePrecheckFailedException when usage exceeds target plan', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      planId: 'plan-pro',
      plan: proPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    const safety = buildSafety({
      ok: false,
      violations: [{ kind: FeatureKey.EMPLOYEES, current: 12, targetMax: 5 }],
    });
    const handler = buildHandler(prisma, buildCache(), safety);

    await expect(
      handler.execute({ planId: 'plan-basic', billingCycle: 'MONTHLY' }),
    ).rejects.toBeInstanceOf(DowngradePrecheckFailedException);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('clears scheduledChangeBlockedReason on a fresh schedule', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      planId: 'plan-pro',
      plan: proPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1' });
    const handler = buildHandler(prisma);

    await handler.execute({ planId: 'plan-basic', billingCycle: 'MONTHLY' });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({ scheduledChangeBlockedReason: null }),
    });
  });
});
