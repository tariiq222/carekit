import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { CancelBookingHandler } from './cancel-booking.handler';
import { buildPrisma, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

const defaultCancelSettings = {
  execute: jest.fn().mockResolvedValue({
    freeCancelBeforeHours: 24,
    freeCancelRefundType: 'FULL',
    lateCancelRefundPercent: 0,
  }),
};

describe('CancelBookingHandler', () => {
  it('cancels PENDING booking and emits event', async () => {
    const prisma = buildPrisma();
    const eb = buildEventBus();
    const result = await new CancelBookingHandler(prisma as never, eb as never, defaultCancelSettings as never).execute({
      bookingId: 'book-1', reason: CancellationReason.CLIENT_REQUESTED, changedBy: 'user-42',
    });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CANCELLED }) }),
    );
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.cancelled', expect.anything());
    expect(result.status).toBe(BookingStatus.CONFIRMED); // mock returns CONFIRMED
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new CancelBookingHandler(prisma as never, buildEventBus() as never, defaultCancelSettings as never).execute({
        bookingId: 'bad', reason: CancellationReason.OTHER, changedBy: 'user-42',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when booking is already CANCELLED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CANCELLED });
    await expect(
      new CancelBookingHandler(prisma as never, buildEventBus() as never, defaultCancelSettings as never).execute({
        bookingId: 'book-1', reason: CancellationReason.OTHER, changedBy: 'user-42',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('CancelBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on cancel', async () => {
    const prisma = buildPrisma();
    const eventBus = { publish: jest.fn() };
    const handler = new CancelBookingHandler(prisma as never, eventBus as never, defaultCancelSettings as never);

    await handler.execute({
      bookingId: 'book-1',
      reason: CancellationReason.CLIENT_REQUESTED,
      changedBy: 'user-42',
    });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.CANCELLED,
        changedBy: 'user-42',
      }),
    });
  });
});

describe('CancelBookingHandler — free cancel window', () => {
  it('attaches freeCancelRefundType when cancelling within free window', async () => {
    const prisma = buildPrisma();
    const eventBus = { publish: jest.fn() };
    const in48h = new Date(Date.now() + 48 * 3_600_000);
    prisma.booking.findUnique.mockResolvedValue({ ...mockBooking, scheduledAt: in48h });
    const settingsHandler = {
      execute: jest.fn().mockResolvedValue({
        freeCancelBeforeHours: 24,
        freeCancelRefundType: 'FULL',
        lateCancelRefundPercent: 0,
      }),
    };
    const handler = new CancelBookingHandler(prisma as never, eventBus as never, settingsHandler as never);

    const result = await handler.execute({
      bookingId: 'book-1',
      reason: CancellationReason.CLIENT_REQUESTED, changedBy: 'user-42',
    });

    expect(result.refundType).toBe('FULL');
  });

  it('attaches NONE when cancelling outside free window', async () => {
    const prisma = buildPrisma();
    const eventBus = { publish: jest.fn() };
    const in10h = new Date(Date.now() + 10 * 3_600_000);
    prisma.booking.findUnique.mockResolvedValue({ ...mockBooking, scheduledAt: in10h });
    const settingsHandler = {
      execute: jest.fn().mockResolvedValue({
        freeCancelBeforeHours: 24,
        freeCancelRefundType: 'FULL',
        lateCancelRefundPercent: 0,
      }),
    };
    const handler = new CancelBookingHandler(prisma as never, eventBus as never, settingsHandler as never);

    const result = await handler.execute({
      bookingId: 'book-1',
      reason: CancellationReason.CLIENT_REQUESTED, changedBy: 'user-42',
    });

    expect(result.refundType).toBe('NONE');
  });
});
