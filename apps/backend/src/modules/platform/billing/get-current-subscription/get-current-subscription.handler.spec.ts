import { GetCurrentSubscriptionHandler } from './get-current-subscription.handler';

const buildPrisma = () => ({
  subscription: {
    findFirst: jest.fn(),
  },
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationId: jest.fn().mockReturnValue(organizationId),
});

describe('GetCurrentSubscriptionHandler', () => {
  it('returns subscription with plan when found', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant('org-A');
    const sub = {
      id: 'sub-1',
      organizationId: 'org-A',
      status: 'ACTIVE',
      plan: { id: 'plan-1', slug: 'basic' },
    };
    prisma.subscription.findFirst.mockResolvedValue(sub);
    const handler = new GetCurrentSubscriptionHandler(prisma as never, tenant as never);

    const result = await handler.execute();

    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-A' },
      include: { plan: true },
    });
    expect(result).toEqual(sub);
  });

  it('returns null when no subscription exists', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant('org-A');
    prisma.subscription.findFirst.mockResolvedValue(null);
    const handler = new GetCurrentSubscriptionHandler(prisma as never, tenant as never);

    const result = await handler.execute();

    expect(result).toBeNull();
  });
});
