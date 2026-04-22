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

  it('sets canceledAt and status CANCELED', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });
    const canceledSub = { id: 'sub-1', status: 'CANCELED', canceledAt: new Date() };
    prisma.subscription.update.mockResolvedValue(canceledSub);
    const handler = new CancelSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

    const result = await handler.execute({ reason: 'Too expensive' });

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          status: 'CANCELED',
          cancelReason: 'Too expensive',
        }),
      }),
    );
    expect(result.status).toBe('CANCELED');
  });

  it('invalidates cache after cancellation', async () => {
    const prisma = buildPrisma();
    const cache = buildCache();
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', status: 'TRIALING' });
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1', status: 'CANCELED' });
    const handler = new CancelSubscriptionHandler(
      prisma as never,
      buildTenant('org-A') as never,
      cache as never,
      new SubscriptionStateMachine(),
    );

    await handler.execute({});

    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
  });
});
