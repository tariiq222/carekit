import { NotFoundException } from '@nestjs/common';
import { GetBookingHandler } from './get-booking.handler';
import { buildPrisma } from '../testing/booking-test-helpers';

const buildTenant = () => ({ requireOrganizationId: () => 'org-test' } as never);

describe('GetBookingHandler', () => {
  it('returns booking', async () => {
    const prisma = buildPrisma();
    const result = await new GetBookingHandler(prisma as never, buildTenant()).execute({ bookingId: 'book-1' });
    expect(result.id).toBe('book-1');
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      new GetBookingHandler(prisma as never, buildTenant()).execute({ bookingId: 'bad' }),
    ).rejects.toThrow(NotFoundException);
  });
});
