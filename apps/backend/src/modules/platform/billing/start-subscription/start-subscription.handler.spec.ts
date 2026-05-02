import { ConflictException, NotFoundException } from '@nestjs/common';
import { StartSubscriptionHandler } from './start-subscription.handler';

const buildPrisma = () => ({
  subscription: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
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

const buildConfig = (trialDays = 14) => ({
  get: jest.fn().mockReturnValue(trialDays),
});

const buildEventBus = () => ({
  publish: jest.fn().mockResolvedValue(undefined),
});

const basicPlan = { id: 'plan-1', slug: 'basic', isActive: true, priceMonthly: 299 };

describe('StartSubscriptionHandler', () => {
  it('throws ConflictException when subscription already exists', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant();
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });
    const handler = new StartSubscriptionHandler(
      prisma as never,
      tenant as never,
      buildCache() as never,
      buildConfig() as never,
      buildEventBus() as never,
    );

    await expect(
      handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException for unknown/inactive plan', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant();
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.plan.findFirst.mockResolvedValue(null);
    const handler = new StartSubscriptionHandler(
      prisma as never,
      tenant as never,
      buildCache() as never,
      buildConfig() as never,
      buildEventBus() as never,
    );

    await expect(
      handler.execute({ planId: 'unknown', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates a TRIALING subscription', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant('org-A');
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    const createdSub = { id: 'sub-1', status: 'TRIALING', organizationId: 'org-A' };
    prisma.subscription.create.mockResolvedValue(createdSub);
    const handler = new StartSubscriptionHandler(
      prisma as never,
      tenant as never,
      buildCache() as never,
      buildConfig() as never,
      buildEventBus() as never,
    );

    const result = await handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' });

    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-A',
          planId: 'plan-1',
          status: 'TRIALING',
          billingCycle: 'MONTHLY',
        }),
      }),
    );
    expect(result.status).toBe('TRIALING');
  });

  it('sets trialEndsAt based on SAAS_TRIAL_DAYS', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant('org-A');
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    prisma.subscription.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'sub-1', ...data }),
    );
    const handler = new StartSubscriptionHandler(
      prisma as never,
      tenant as never,
      buildCache() as never,
      buildConfig(7) as never,
      buildEventBus() as never,
    );

    const before = Date.now();
    await handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' });
    const after = Date.now();

    const createCall = prisma.subscription.create.mock.calls[0][0];
    const trialEndsAt: Date = createCall.data.trialEndsAt;
    const expectedMin = before + 7 * 86_400_000;
    const expectedMax = after + 7 * 86_400_000;
    expect(trialEndsAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(trialEndsAt.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it('sets trialStartedAt when creating the trial subscription', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant('org-A');
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    prisma.subscription.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'sub-1', ...data }),
    );
    const handler = new StartSubscriptionHandler(
      prisma as never,
      tenant as never,
      buildCache() as never,
      buildConfig() as never,
      buildEventBus() as never,
    );

    const before = Date.now();
    await handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' });
    const after = Date.now();

    const createCall = prisma.subscription.create.mock.calls[0][0];
    const trialStartedAt: Date = createCall.data.trialStartedAt;
    expect(trialStartedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(trialStartedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('invalidates cache after creating subscription', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant('org-A');
    const cache = buildCache();
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    prisma.subscription.create.mockResolvedValue({ id: 'sub-1', status: 'TRIALING' });
    const handler = new StartSubscriptionHandler(
      prisma as never,
      tenant as never,
      cache as never,
      buildConfig() as never,
      buildEventBus() as never,
    );

    await handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' });

    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
  });
});
