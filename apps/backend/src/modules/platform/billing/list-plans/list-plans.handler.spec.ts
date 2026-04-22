import { ListPlansHandler } from './list-plans.handler';

const buildPrisma = () => ({
  plan: {
    findMany: jest.fn(),
  },
});

describe('ListPlansHandler', () => {
  it('returns sorted active plans', async () => {
    const prisma = buildPrisma();
    const plans = [
      { id: 'plan-1', slug: 'basic', isActive: true, sortOrder: 1 },
      { id: 'plan-2', slug: 'pro', isActive: true, sortOrder: 2 },
    ];
    prisma.plan.findMany.mockResolvedValue(plans);
    const handler = new ListPlansHandler(prisma as never);

    const result = await handler.execute();

    expect(prisma.plan.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    expect(result).toEqual(plans);
  });

  it('excludes inactive plans', async () => {
    const prisma = buildPrisma();
    const activePlans = [{ id: 'plan-1', slug: 'basic', isActive: true, sortOrder: 1 }];
    prisma.plan.findMany.mockResolvedValue(activePlans);
    const handler = new ListPlansHandler(prisma as never);

    const result = await handler.execute();

    expect(prisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(result).toEqual(activePlans);
  });
});
