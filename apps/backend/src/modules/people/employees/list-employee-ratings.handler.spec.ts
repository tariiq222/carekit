import { NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant';
import { ListEmployeeRatingsHandler } from './list-employee-ratings.handler';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const mockRating = {
  id: 'rating-1',
  organizationId: DEFAULT_ORG,
  bookingId: 'booking-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  score: 5,
  comment: 'ممتاز',
  isPublic: true,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
};

const buildPrisma = () => ({
  employee: {
    findFirst: jest.fn().mockResolvedValue({ id: 'emp-1' }),
  },
  rating: {
    findMany: jest.fn().mockResolvedValue([mockRating]),
    count: jest.fn().mockResolvedValue(1),
  },
  $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops as Promise<unknown>[])),
});

const buildTenant = (organizationId = DEFAULT_ORG) =>
  ({
    requireOrganizationId: jest.fn().mockReturnValue(organizationId),
  }) as unknown as TenantContextService;

const buildHandler = (
  prisma: ReturnType<typeof buildPrisma>,
  tenant: TenantContextService,
) => new ListEmployeeRatingsHandler(prisma as never, tenant);

describe('ListEmployeeRatingsHandler', () => {
  it('returns paginated employee ratings scoped by organization', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant();
    const handler = buildHandler(prisma, tenant);

    const result = await handler.execute({ employeeId: 'emp-1', page: 2, limit: 5 });

    expect(tenant.requireOrganizationId).toHaveBeenCalled();
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { id: 'emp-1', organizationId: DEFAULT_ORG },
      select: { id: true },
    });
    expect(prisma.rating.findMany).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1', organizationId: DEFAULT_ORG },
      skip: 5,
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    expect(result.items).toEqual([mockRating]);
    expect(result.meta).toMatchObject({
      total: 1,
      page: 2,
      perPage: 5,
    });
  });

  it('throws when employee is outside the active organization', async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValueOnce(null);
    const handler = buildHandler(prisma, buildTenant());

    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(NotFoundException);
  });
});
