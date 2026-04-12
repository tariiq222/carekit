import { ListBookingsHandler } from './list-bookings.handler';
import { buildPrisma, mockBooking } from '../testing/booking-test-helpers';

describe('ListBookingsHandler', () => {
  it('returns paginated bookings', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([mockBooking]);
    const result = await new ListBookingsHandler(prisma as never).execute({
      tenantId: 'tenant-1', page: 1, limit: 10,
    });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});
