import { BadRequestException } from '@nestjs/common';
import { CancelScheduledDowngradeHandler } from './cancel-scheduled-downgrade.handler';

const buildPrisma = () => ({
  subscription: { findFirst: jest.fn(), update: jest.fn() },
});

const buildTenant = () => ({
  requireOrganizationId: jest.fn().mockReturnValue('org-A'),
});

const buildCache = () => ({ invalidate: jest.fn() });

const buildHandler = (prisma: ReturnType<typeof buildPrisma>, cache = buildCache()) =>
  new CancelScheduledDowngradeHandler(prisma as never, buildTenant() as never, cache as never);

describe('CancelScheduledDowngradeHandler', () => {
  it('rejects when there is no scheduled downgrade', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      scheduledPlanId: null,
    });
    const handler = buildHandler(prisma);

    await expect(handler.execute()).rejects.toThrow(BadRequestException);
  });

  it('clears scheduled plan fields and invalidates cache', async () => {
    const prisma = buildPrisma();
    const cache = buildCache();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      scheduledPlanId: 'plan-basic',
    });
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1', scheduledPlanId: null });
    const handler = buildHandler(prisma, cache);

    const result = await handler.execute();

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        scheduledPlanId: null,
        scheduledBillingCycle: null,
        scheduledPlanChangeAt: null,
        scheduledChangeBlockedReason: null,
      },
    });
    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
    expect(result).toEqual({ id: 'sub-1', scheduledPlanId: null });
  });
});
