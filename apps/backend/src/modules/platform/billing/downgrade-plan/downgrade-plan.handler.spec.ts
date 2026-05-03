import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { DowngradePlanHandler } from './downgrade-plan.handler';
import { SubscriptionStateMachine } from '../subscription-state-machine';
import { DowngradePrecheckFailedException } from '../downgrade-safety/downgrade-precheck.exception';

const buildPrisma = () => ({
  subscription: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  plan: {
    findFirst: jest.fn(),
  },
  membership: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationId: jest.fn().mockReturnValue(organizationId),
});

const buildCache = () => ({
  invalidate: jest.fn(),
});

const buildMailer = () => ({
  sendPlanChanged: jest.fn().mockResolvedValue(undefined),
});

const buildConfig = () => ({
  get: jest.fn().mockImplementation((_key: string, def: unknown) => def),
});

const buildEventBus = () => ({
  publish: jest.fn().mockResolvedValue(undefined),
});

const buildSafety = (
  result: { ok: boolean; violations: Array<{ kind: string; current: number; targetMax: number }> } = { ok: true, violations: [] },
) => ({
  checkDowngrade: jest.fn().mockResolvedValue(result),
});

const buildHandler = (
  prisma: ReturnType<typeof buildPrisma>,
  tenant = buildTenant(),
  cache = buildCache(),
  mailer = buildMailer(),
  safety: ReturnType<typeof buildSafety> = buildSafety(),
) =>
  new DowngradePlanHandler(
    prisma as never,
    tenant as never,
    cache as never,
    new SubscriptionStateMachine(),
    mailer as never,
    buildConfig() as never,
    buildEventBus() as never,
    safety as never,
  );

const basicPlan = { id: 'plan-1', slug: 'basic', nameAr: 'أساسي', priceMonthly: 299, isActive: true };
const proPlan = { id: 'plan-2', slug: 'pro', nameAr: 'احترافي', priceMonthly: 799 };

describe('DowngradePlanHandler', () => {
  it('throws NotFoundException when no subscription exists', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(null);
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for CANCELED subscription', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'CANCELED',
      plan: proPlan,
    });
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for SUSPENDED subscription', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'SUSPENDED',
      plan: proPlan,
    });
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when target price is equal or higher', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      plan: basicPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow('Target plan is not a downgrade');
  });

  it('updates planId and invalidates cache on successful downgrade', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant('org-A');
    const cache = buildCache();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      plan: proPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    const updatedSub = { id: 'sub-1', planId: 'plan-1' };
    prisma.subscription.update.mockResolvedValue(updatedSub);
    const handler = buildHandler(prisma, tenant, cache);

    const result = await handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' });

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: expect.objectContaining({ planId: 'plan-1' }),
      }),
    );
    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
    expect(result).toEqual(updatedSub);
  });

  it('sends a plan-changed email to the org owner after downgrade', async () => {
    const prisma = buildPrisma();
    const mailer = buildMailer();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      plan: proPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1', planId: 'plan-1' });
    prisma.membership.findFirst.mockResolvedValue({
      user: { email: 'owner@example.com', name: 'Owner' },
      organization: { nameAr: 'Org AR' },
    });
    const handler = buildHandler(prisma, buildTenant('org-A'), buildCache(), mailer);

    await handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' });

    expect(mailer.sendPlanChanged).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({
        fromPlanName: 'احترافي',
        toPlanName: 'أساسي',
        effectiveDate: expect.any(String),
      }),
    );
  });

  it('throws DowngradePrecheckFailedException when employees exceed target plan', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      plan: proPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    const safety = buildSafety({
      ok: false,
      violations: [{ kind: FeatureKey.EMPLOYEES, current: 12, targetMax: 5 }],
    });
    const handler = buildHandler(prisma, buildTenant(), buildCache(), buildMailer(), safety);

    await expect(
      handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' }),
    ).rejects.toBeInstanceOf(DowngradePrecheckFailedException);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('succeeds when usage fits target plan', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      plan: proPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1', planId: 'plan-1' });
    const safety = buildSafety({ ok: true, violations: [] });
    const handler = buildHandler(prisma, buildTenant(), buildCache(), buildMailer(), safety);

    const result = await handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' });
    expect(safety.checkDowngrade).toHaveBeenCalled();
    expect(result).toEqual({ id: 'sub-1', planId: 'plan-1' });
  });
});
