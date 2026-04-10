import { ConflictException } from '@nestjs/common';
import { checkDoubleBooking } from '../../../src/modules/bookings/booking-validation.helper.js';

function makeBookingFinder(existing: Array<{ startTime: string; endTime: string }>) {
  return {
    practitionerVacation: {} as never,
    practitionerAvailability: {} as never,
    booking: {
      findMany: async () => existing,
    },
  };
}

describe('checkDoubleBooking', () => {
  it('allows a booking just outside buffer window', async () => {
    // Existing: 10:00–10:30. Buffer: 15 min. New: 10:45–11:15.
    // With single-side buffer: new effective window 10:30–11:30, existing 10:00–10:30 → no overlap.
    const prisma = makeBookingFinder([{ startTime: '10:00', endTime: '10:30' }]);
    await expect(
      checkDoubleBooking(prisma as never, 'p1', new Date(), '10:45', '11:15', undefined, 15),
    ).resolves.toBeUndefined();
  });

  it('rejects a booking within buffer window', async () => {
    // Existing: 10:00–10:30. Buffer: 15 min. New: 10:40–11:10.
    // New effective window: 10:25–11:25. Existing ends at 10:30 → overlap.
    const prisma = makeBookingFinder([{ startTime: '10:00', endTime: '10:30' }]);
    await expect(
      checkDoubleBooking(prisma as never, 'p1', new Date(), '10:40', '11:10', undefined, 15),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows back-to-back booking with zero buffer', async () => {
    // Existing: 10:00–10:30. Buffer: 0. New: 10:30–11:00 → no conflict.
    const prisma = makeBookingFinder([{ startTime: '10:00', endTime: '10:30' }]);
    await expect(
      checkDoubleBooking(prisma as never, 'p1', new Date(), '10:30', '11:00', undefined, 0),
    ).resolves.toBeUndefined();
  });

  it('previously double-applied buffer would have rejected 10:45 slot with 15min buffer — now allowed', async () => {
    // C1 regression test: old code would expand existing 10:00–10:30 → 09:45–10:45
    // and new 10:45–11:15 → 10:30–11:30 → overlap at 10:30–10:45 → incorrect reject.
    // Fixed code: only new slot expanded → 10:30–11:30 vs existing 10:00–10:30 → no overlap at boundary.
    const prisma = makeBookingFinder([{ startTime: '10:00', endTime: '10:30' }]);
    await expect(
      checkDoubleBooking(prisma as never, 'p1', new Date(), '10:45', '11:15', undefined, 15),
    ).resolves.toBeUndefined();
  });
});
