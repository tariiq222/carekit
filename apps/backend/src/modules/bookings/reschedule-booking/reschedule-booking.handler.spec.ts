import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { RescheduleBookingHandler } from './reschedule-booking.handler';
import { buildPrisma, mockBooking } from '../testing/booking-test-helpers';

const defaultRescheduleSettings = {
  execute: jest.fn().mockResolvedValue({ maxReschedulesPerBooking: 3 }),
};

describe('RescheduleBookingHandler', () => {
  const newFuture = new Date(Date.now() + 172800_000);

  it('reschedules booking when new slot is free', async () => {
    const prisma = buildPrisma();
    await new RescheduleBookingHandler(prisma as never, defaultRescheduleSettings as never).execute({
      bookingId: 'book-1', newScheduledAt: newFuture, changedBy: 'user-42',
    });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scheduledAt: newFuture }) }),
    );
  });

  it('throws BadRequestException when booking is COMPLETED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.COMPLETED });
    await expect(
      new RescheduleBookingHandler(prisma as never, defaultRescheduleSettings as never).execute({
        bookingId: 'book-1', newScheduledAt: newFuture, changedBy: 'user-42',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('RescheduleBookingHandler — maxReschedulesPerBooking', () => {
  it('allows reschedule when count is below max', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingStatusLog.count = jest.fn().mockResolvedValue(2);
    const settingsHandler = { execute: jest.fn().mockResolvedValue({ maxReschedulesPerBooking: 3 }) };
    const handler = new RescheduleBookingHandler(prisma as never, settingsHandler as never);
    const newTime = new Date(Date.now() + 2 * 86400_000);

    await expect(
      handler.execute({ bookingId: 'book-1', newScheduledAt: newTime, changedBy: 'user-42' }),
    ).resolves.toBeDefined();
  });

  it('throws BadRequestException when max reschedules reached', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingStatusLog.count = jest.fn().mockResolvedValue(3);
    const settingsHandler = { execute: jest.fn().mockResolvedValue({ maxReschedulesPerBooking: 3 }) };
    const handler = new RescheduleBookingHandler(prisma as never, settingsHandler as never);
    const newTime = new Date(Date.now() + 2 * 86400_000);

    await expect(
      handler.execute({ bookingId: 'book-1', newScheduledAt: newTime, changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes rescheduled log entry on success', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingStatusLog.count = jest.fn().mockResolvedValue(0);
    const settingsHandler = { execute: jest.fn().mockResolvedValue({ maxReschedulesPerBooking: 3 }) };
    const handler = new RescheduleBookingHandler(prisma as never, settingsHandler as never);
    const newTime = new Date(Date.now() + 2 * 86400_000);

    await handler.execute({ bookingId: 'book-1', newScheduledAt: newTime, changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reason: 'rescheduled', changedBy: 'user-42' }),
    });
  });
});
