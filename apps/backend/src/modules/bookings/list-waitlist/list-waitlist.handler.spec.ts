import { ListWaitlistHandler } from './list-waitlist.handler';
import { buildPrisma } from '../testing/booking-test-helpers';

describe('ListWaitlistHandler', () => {
  it('lists waitlist entries scoped to tenant', async () => {
    const prisma = buildPrisma();
    const entries = [{ id: 'wl-1', status: 'WAITING' }];
    prisma.waitlistEntry.findMany = jest.fn().mockResolvedValue(entries);
    const result = await new ListWaitlistHandler(prisma as never).execute({ tenantId: 'tenant-1' });
    expect(result).toEqual(entries);
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
  });

  it('filters by employeeId and status when provided', async () => {
    const prisma = buildPrisma();
    await new ListWaitlistHandler(prisma as never).execute({
      tenantId: 'tenant-1', employeeId: 'emp-1', status: 'WAITING',
    });
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', employeeId: 'emp-1', status: 'WAITING' },
      }),
    );
  });
});
