import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ComputeProrationHandler } from './compute-proration.handler';

const periodStart = new Date('2026-04-01T00:00:00.000Z');
const periodEnd = new Date('2026-05-01T00:00:00.000Z');

const basicPlan = {
  id: 'plan-basic',
  priceMonthly: '300.00',
  priceAnnual: '3000.00',
  isActive: true,
};

const proPlan = {
  id: 'plan-pro',
  priceMonthly: '900.00',
  priceAnnual: '9000.00',
  isActive: true,
};

// Plans matching the bug report: BASIC 249.92/mo (2999/yr), PRO 799/mo
const bugReportBasicPlan = {
  id: 'plan-basic-bug',
  priceMonthly: '299.00',
  priceAnnual: '2999.00',
  isActive: true,
};

const bugReportProPlan = {
  id: 'plan-pro-bug',
  priceMonthly: '799.00',
  priceAnnual: '7999.00',
  isActive: true,
};

const buildPrisma = () => ({
  subscription: { findFirst: jest.fn() },
  plan: { findFirst: jest.fn() },
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationId: jest.fn().mockReturnValue(organizationId),
});

const buildHandler = (prisma: ReturnType<typeof buildPrisma>) =>
  new ComputeProrationHandler(prisma as never, buildTenant() as never);

describe('ComputeProrationHandler', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-16T00:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws NotFoundException when no subscription exists', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(null);
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-pro', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when target plan is inactive or missing', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      plan: basicPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(null);
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-pro', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.plan.findFirst).toHaveBeenCalledWith({
      where: { id: 'plan-pro', isActive: true },
      select: { id: true, priceMonthly: true, priceAnnual: true },
    });
  });

  it('returns UPGRADE_NOW and the prorated charge for upgrades', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      plan: basicPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    const handler = buildHandler(prisma);

    const result = await handler.execute({ planId: 'plan-pro', billingCycle: 'MONTHLY' });

    expect(result).toMatchObject({
      action: 'UPGRADE_NOW',
      targetPlanId: 'plan-pro',
      billingCycle: 'MONTHLY',
      amountSar: '300.00',
      amountHalalas: 30000,
      isUpgrade: true,
    });
  });

  it('returns SCHEDULE_DOWNGRADE and currentPeriodEnd for downgrades', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      plan: proPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    const handler = buildHandler(prisma);

    const result = await handler.execute({ planId: 'plan-basic', billingCycle: 'MONTHLY' });

    expect(result).toMatchObject({
      action: 'SCHEDULE_DOWNGRADE',
      amountSar: '0.00',
      amountHalalas: 0,
      effectiveAt: periodEnd,
      isUpgrade: false,
    });
  });

  it('returns an immediate zero-charge plan change during trial', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'TRIALING',
      billingCycle: 'MONTHLY',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      plan: proPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    const handler = buildHandler(prisma);

    const result = await handler.execute({ planId: 'plan-basic', billingCycle: 'MONTHLY' });

    expect(result).toMatchObject({
      action: 'UPGRADE_NOW',
      trialChange: true,
      amountSar: '0.00',
      amountHalalas: 0,
      effectiveAt: new Date('2026-04-16T00:00:00.000Z'),
    });
  });

  it.each(['CANCELED', 'SUSPENDED'])('rejects %s subscriptions', async (status) => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status,
      billingCycle: 'MONTHLY',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      plan: basicPlan,
    });
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-pro', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks that an upgrade will clear scheduled cancellation warnings', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true,
      plan: basicPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-pro', billingCycle: 'MONTHLY' }),
    ).resolves.toMatchObject({ action: 'UPGRADE_NOW', clearsScheduledCancellation: true });
  });

  it('correctly identifies upgrade when current is ANNUAL BASIC and target is MONTHLY PRO (the bug case)', async () => {
    // Bug: ANNUAL BASIC (2999 SAR/yr) vs MONTHLY PRO (799 SAR/mo)
    // Old code compared 2999 vs 799 and wrongly concluded downgrade.
    // Monthly-equivalent of BASIC annual = 2999/12 = 249.92 SAR/mo < 799 SAR/mo → upgrade.
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'ANNUAL',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      plan: bugReportBasicPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(bugReportProPlan);
    const handler = buildHandler(prisma);

    const result = await handler.execute({ planId: 'plan-pro-bug', billingCycle: 'MONTHLY' });

    expect(result).toMatchObject({
      isUpgrade: true,
      action: 'UPGRADE_NOW',
    });
  });

  it('correctly identifies downgrade when current is MONTHLY PRO and target is ANNUAL BASIC (inverse direction)', async () => {
    // MONTHLY PRO (799 SAR/mo) vs ANNUAL BASIC (2999/12 = 249.92 SAR/mo) → downgrade.
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      plan: bugReportProPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(bugReportBasicPlan);
    const handler = buildHandler(prisma);

    const result = await handler.execute({ planId: 'plan-basic-bug', billingCycle: 'ANNUAL' });

    expect(result).toMatchObject({
      isUpgrade: false,
      action: 'SCHEDULE_DOWNGRADE',
    });
  });
});
