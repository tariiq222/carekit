import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { CompleteBookingHandler } from './complete-booking.handler';
import { buildPrisma, buildTenant, mockBooking } from '../testing/booking-test-helpers';

describe('CompleteBookingHandler', () => {
  it('completes CONFIRMED booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await new CompleteBookingHandler(prisma as never, buildTenant() as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.COMPLETED }) }),
    );
  });

  it('throws BadRequestException when booking is not CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CANCELLED });
    await expect(
      new CompleteBookingHandler(prisma as never, buildTenant() as never).execute({ bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new CompleteBookingHandler(prisma as never, buildTenant() as never).execute({ bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CompleteBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on complete', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new CompleteBookingHandler(prisma as never, buildTenant() as never);

    await handler.execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.COMPLETED,
        changedBy: 'user-42',
      }),
    });
  });
});
