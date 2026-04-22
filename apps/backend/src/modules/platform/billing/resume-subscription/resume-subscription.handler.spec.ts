import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ResumeSubscriptionHandler } from './resume-subscription.handler';
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

describe('ResumeSubscriptionHandler', () => {
  it('throws NotFoundException when no subscription exists', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(null);
    const handler = new ResumeSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

    await expect(handler.execute({} as never)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when no card token on file', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'SUSPENDED',
      moyasarCardTokenRef: null,
    });
    const handler = new ResumeSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

    await expect(handler.execute({} as never)).rejects.toThrow(
      'No payment method on file',
    );
  });

  it('throws when status is not SUSPENDED (state machine rejects)', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      moyasarCardTokenRef: 'tok_abc',
    });
    const handler = new ResumeSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

    await expect(handler.execute({} as never)).rejects.toThrow(
      'Illegal subscription transition from ACTIVE on resumeSuccess',
    );
  });

  it('sets status to ACTIVE and clears pastDueSince', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'SUSPENDED',
      moyasarCardTokenRef: 'tok_abc',
    });
    const updatedSub = { id: 'sub-1', status: 'ACTIVE', pastDueSince: null };
    prisma.subscription.update.mockResolvedValue(updatedSub);
    const handler = new ResumeSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
    );

    const result = await handler.execute({} as never);

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: expect.objectContaining({ status: 'ACTIVE', pastDueSince: null }),
      }),
    );
    expect(result.status).toBe('ACTIVE');
    expect(result.pastDueSince).toBeNull();
  });

  it('invalidates cache after resuming', async () => {
    const prisma = buildPrisma();
    const cache = buildCache();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'SUSPENDED',
      moyasarCardTokenRef: 'tok_abc',
    });
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });
    const handler = new ResumeSubscriptionHandler(
      prisma as never,
      buildTenant('org-A') as never,
      cache as never,
      new SubscriptionStateMachine(),
    );

    await handler.execute({} as never);

    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
  });
});
