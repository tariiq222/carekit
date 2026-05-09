import { ListWaitlistHandler } from './list-waitlist.handler';
import { buildPrisma } from '../testing/booking-test-helpers';

const buildTenant = () => ({ requireOrganizationId: () => 'org-test' } as never);

describe('ListWaitlistHandler', () => {
  it('lists all waitlist entries', async () => {
    const prisma = buildPrisma();
    const entries = [{ id: 'wl-1', status: 'WAITING' }];
    prisma.waitlistEntry.findMany = jest.fn().mockResolvedValue(entries);
    const result = await new ListWaitlistHandler(prisma as never, buildTenant()).execute({});
    expect(result).toEqual(entries);
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-test' } }),
    );
  });

  it('filters by employeeId and status when provided', async () => {
    const prisma = buildPrisma();
    await new ListWaitlistHandler(prisma as never, buildTenant()).execute({
      employeeId: 'emp-1', status: 'WAITING',
    });
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-test', employeeId: 'emp-1', status: 'WAITING' },
      }),
    );
  });
});
