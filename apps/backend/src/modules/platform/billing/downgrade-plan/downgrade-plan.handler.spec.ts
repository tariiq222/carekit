import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DowngradePlanHandler } from './downgrade-plan.handler';
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

const basicPlan = { id: 'plan-1', slug: 'basic', priceMonthly: 299, isActive: true };
const proPlan = { id: 'plan-2', slug: 'pro', priceMonthly: 799 };

describe('DowngradePlanHandler', () => {
  it('throws NotFoundException when no subscription exists', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(null);
    const handler = new DowngradePlanHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

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
    const handler = new DowngradePlanHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

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
    const handler = new DowngradePlanHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

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
    const handler = new DowngradePlanHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

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
    const handler = new DowngradePlanHandler(
      prisma as never,
      tenant as never,
      cache as never,
      new SubscriptionStateMachine(),
    );

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
});
