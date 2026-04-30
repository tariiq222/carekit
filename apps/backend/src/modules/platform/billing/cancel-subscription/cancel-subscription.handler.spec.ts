import { NotFoundException } from '@nestjs/common';
import { CancelSubscriptionHandler } from './cancel-subscription.handler';
import { SubscriptionStateMachine } from '../subscription-state-machine';

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

describe('CancelSubscriptionHandler', () => {
  it('throws NotFoundException when no subscription exists', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(null);
    const handler = new CancelSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

    await expect(handler.execute({})).rejects.toThrow(NotFoundException);
  });

  it('throws when trying to cancel an already CANCELED subscription', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', status: 'CANCELED' });
    const handler = new CancelSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

    await expect(handler.execute({})).rejects.toThrow(
      'Illegal subscription transition from CANCELED on cancel',
    );
  });

  it('cancels TRIALING subscriptions immediately', async () => {
    const prisma = buildPrisma();
    const cache = buildCache();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-trial',
      status: 'TRIALING',
      currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
    });
    prisma.subscription.update.mockResolvedValue({ id: 'sub-trial', status: 'CANCELED' });
    const handler = new CancelSubscriptionHandler(
      prisma as never,
      buildTenant('org-A') as never,
      cache as never,
      new SubscriptionStateMachine(),
    );

    await handler.execute({ reason: 'closing' });

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-trial' },
        data: expect.objectContaining({
          status: 'CANCELED',
          canceledAt: expect.any(Date),
          cancelReason: 'closing',
          cancelAtPeriodEnd: false,
          scheduledCancellationDate: null,
        }),
      }),
    );
    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
  });

  it('schedules ACTIVE subscriptions at currentPeriodEnd', async () => {
    const prisma = buildPrisma();
    const periodEnd = new Date('2026-05-01T00:00:00.000Z');
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-active',
      status: 'ACTIVE',
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });
    prisma.subscription.update.mockResolvedValue({
      id: 'sub-active',
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      scheduledCancellationDate: periodEnd,
    });
    const handler = new CancelSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

    const result = await handler.execute({ reason: 'budget' });

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-active' },
        data: {
          cancelAtPeriodEnd: true,
          scheduledCancellationDate: periodEnd,
          cancelReason: 'budget',
        },
      }),
    );
    expect(result.status).toBe('ACTIVE');
  });

  it('rejects scheduling when cancellation is already scheduled', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-active',
      status: 'ACTIVE',
      currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
      cancelAtPeriodEnd: true,
    });
    const handler = new CancelSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

    await expect(handler.execute({})).rejects.toThrow(
      'subscription_cancellation_already_scheduled',
    );
  });
});
