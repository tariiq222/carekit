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
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationId: jest.fn().mockReturnValue(organizationId),
});

const buildCache = () => ({
  invalidate: jest.fn(),
});

const basicPlan = { id: 'plan-1', slug: 'basic', priceMonthly: 299 };
const proPlan = { id: 'plan-2', slug: 'pro', priceMonthly: 799, isActive: true };

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
});
