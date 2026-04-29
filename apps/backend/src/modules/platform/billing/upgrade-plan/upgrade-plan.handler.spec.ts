import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpgradePlanHandler } from './upgrade-plan.handler';
import { SubscriptionStateMachine } from '../subscription-state-machine';

const buildPrisma = () => ({
  subscription: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  plan: {
    findFirst: jest.fn(),
  },
  $allTenants: {
    membership: {
      findFirst: jest.fn().mockResolvedValue({
        user: { email: 'owner@example.com', name: 'Owner' },
        organization: { nameAr: 'Org AR' },
      }),
    },
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

const basicPlan = { id: 'plan-1', slug: 'basic', nameAr: 'أساسي', priceMonthly: 299 };
const proPlan = { id: 'plan-2', slug: 'pro', nameAr: 'احترافي', priceMonthly: 799, isActive: true };

describe('UpgradePlanHandler', () => {
  it('throws NotFoundException when no subscription exists', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant();
    prisma.subscription.findFirst.mockResolvedValue(null);
    const handler = new UpgradePlanHandler(
      prisma as never,
      tenant as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await expect(
      handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for CANCELED subscription', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'CANCELED',
      plan: basicPlan,
    });
    const handler = new UpgradePlanHandler(
      prisma as never,
      tenant as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await expect(
      handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for SUSPENDED subscription', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'SUSPENDED',
      plan: basicPlan,
    });
    const handler = new UpgradePlanHandler(
      prisma as never,
      tenant as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await expect(
      handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when target plan is not an upgrade', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      plan: proPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    const handler = new UpgradePlanHandler(
      prisma as never,
      tenant as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await expect(
      handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow('Target plan is not an upgrade');
  });

  it('updates planId and invalidates cache on successful upgrade', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant('org-A');
    const cache = buildCache();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      plan: basicPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    const updatedSub = { id: 'sub-1', planId: 'plan-2' };
    prisma.subscription.update.mockResolvedValue(updatedSub);
    const handler = new UpgradePlanHandler(
      prisma as never,
      tenant as never,
      cache as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    const result = await handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' });

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: expect.objectContaining({ planId: 'plan-2' }),
      }),
    );
    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
    expect(result).toEqual(updatedSub);
  });

  it('sends a plan-changed email to the org owner after upgrade', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant('org-A');
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      plan: basicPlan,
    });
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1', planId: 'plan-2' });
    const mailer = buildMailer();
    const handler = new UpgradePlanHandler(
      prisma as never,
      tenant as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      mailer as never,
      buildConfig() as never,
    );

    await handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' });

    expect(mailer.sendPlanChanged).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({
        fromPlanName: 'أساسي',
        toPlanName: 'احترافي',
        effectiveDate: expect.any(String),
      }),
    );
  });
});
