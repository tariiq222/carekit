import { ConflictException } from '@nestjs/common';
import { AddToWaitlistHandler } from './add-to-waitlist.handler';
import { buildPrisma, buildTenant } from '../testing/booking-test-helpers';

describe('AddToWaitlistHandler', () => {
  it('adds client to waitlist', async () => {
    const prisma = buildPrisma();
    const result = await new AddToWaitlistHandler(prisma as never, buildTenant() as never).execute({
      clientId: 'client-1', employeeId: 'emp-1',
      serviceId: 'svc-1', branchId: 'branch-1',
    });
    expect(result.status).toBe('WAITING');
  });

  it('throws ConflictException when already on waitlist', async () => {
    const prisma = buildPrisma();
    prisma.waitlistEntry.findFirst = jest.fn().mockResolvedValue({ id: 'wl-1' });
    await expect(
      new AddToWaitlistHandler(prisma as never, buildTenant() as never).execute({
        clientId: 'client-1', employeeId: 'emp-1',
        serviceId: 'svc-1', branchId: 'branch-1',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
