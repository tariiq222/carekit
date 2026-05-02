import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReactivateSubscriptionHandler } from './reactivate-subscription.handler';

const buildPrisma = () => ({
  subscription: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationId: jest.fn().mockReturnValue(organizationId),
});

const buildCache = () => ({
  invalidate: jest.fn(),
});

const buildEventBus = () => ({
  publish: jest.fn().mockResolvedValue(undefined),
});

describe('ReactivateSubscriptionHandler', () => {
  it('throws NotFoundException when no subscription exists', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(null);
    const handler = new ReactivateSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      buildEventBus() as never,
    );

    await expect(handler.execute()).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when no cancellation is scheduled', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
    });
    const handler = new ReactivateSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      buildEventBus() as never,
    );

    await expect(handler.execute()).rejects.toThrow(BadRequestException);
  });

  it('clears scheduled cancellation fields and invalidates cache', async () => {
    const prisma = buildPrisma();
    const cache = buildCache();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      scheduledCancellationDate: new Date('2026-05-01T00:00:00.000Z'),
    });
    prisma.subscription.update.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
      scheduledCancellationDate: null,
    });
    const handler = new ReactivateSubscriptionHandler(
      prisma as never,
      buildTenant('org-A') as never,
      cache as never,
      buildEventBus() as never,
    );

    const result = await handler.execute();

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        cancelAtPeriodEnd: false,
        scheduledCancellationDate: null,
        cancelReason: null,
      },
    });
    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
  });

  it('rejects terminal CANCELED subscriptions', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'CANCELED',
      cancelAtPeriodEnd: true,
    });
    const handler = new ReactivateSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      buildEventBus() as never,
    );

    await expect(handler.execute()).rejects.toThrow('subscription_not_reactivatable');
  });
});
