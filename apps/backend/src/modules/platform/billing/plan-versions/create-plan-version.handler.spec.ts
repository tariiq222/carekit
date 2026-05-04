import { CreatePlanVersionHandler } from './create-plan-version.handler';

const buildPrisma = (currentMaxVersion = 0) => ({
  $allTenants: {
    planVersion: {
      findFirst: jest.fn().mockResolvedValue(
        currentMaxVersion ? { version: currentMaxVersion } : null,
      ),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pv-1', ...data }),
      ),
    },
    plan: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'plan-pro',
        priceMonthly: '299.00',
        priceAnnual: '2990.00',
        currency: 'SAR',
        limits: { maxBookingsPerMonth: 1000 },
      }),
    },
  },
});

describe('CreatePlanVersionHandler', () => {
  it('creates version 1 when no prior version exists', async () => {
    const prisma = buildPrisma(0);
    const handler = new CreatePlanVersionHandler(prisma as never);
    await handler.execute({ planId: 'plan-pro' });
    expect(prisma.$allTenants.planVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        planId: 'plan-pro',
        version: 1,
        priceMonthly: '299.00',
        priceAnnual: '2990.00',
        currency: 'SAR',
        limits: { maxBookingsPerMonth: 1000 },
      }),
    });
  });

  it('increments version when prior versions exist', async () => {
    const prisma = buildPrisma(3);
    const handler = new CreatePlanVersionHandler(prisma as never);
    await handler.execute({ planId: 'plan-pro' });
    expect(prisma.$allTenants.planVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 4 }),
    });
  });

  it('throws if plan does not exist', async () => {
    const prisma = buildPrisma(0);
    prisma.$allTenants.plan.findFirst.mockResolvedValueOnce(null);
    const handler = new CreatePlanVersionHandler(prisma as never);
    await expect(handler.execute({ planId: 'missing' })).rejects.toThrow(/not found/i);
  });
});
