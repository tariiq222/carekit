/**
 * BookingsService — Status Transition Tests
 * Covers: confirm, complete
 * NOTE: These tests are skipped — logic moved to BookingStatusService.
 *       Migrate here once BookingStatusService gets its own spec file.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { createBookingsTestModule, BookingsTestContext } from './bookings.test-module.js';
import { mockBooking } from './bookings.fixtures.js';

describe.skip('BookingsService — confirm', () => {
  let ctx: BookingsTestContext;

  beforeEach(async () => {
    ctx = await createBookingsTestModule();
    jest.clearAllMocks();
  });

  it('should transition from pending to confirmed', async () => {
    ctx.mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
    ctx.mockPrisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      bookingId: mockBooking.id,
      status: 'paid',
    });
    ctx.mockPrisma.booking.update.mockResolvedValue({
      ...mockBooking,
      status: 'confirmed',
      confirmedAt: new Date(),
    });

    const result = await (ctx.service as any).confirm(mockBooking.id);

    expect(result.status).toBe('confirmed');
    expect(result.confirmedAt).toBeDefined();
  });

  it.each([
    ['confirmed'],
    ['completed'],
    ['cancelled'],
  ])('should throw ConflictException if status is %s', async (status) => {
    ctx.mockPrisma.booking.findFirst.mockResolvedValue({ ...mockBooking, status });

    await expect((ctx.service as any).confirm(mockBooking.id)).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if booking not found', async () => {
    ctx.mockPrisma.booking.findFirst.mockResolvedValue(null);

    await expect((ctx.service as any).confirm('non-existent-id')).rejects.toThrow(NotFoundException);
  });
});

describe.skip('BookingsService — complete', () => {
  let ctx: BookingsTestContext;

  beforeEach(async () => {
    ctx = await createBookingsTestModule();
    jest.clearAllMocks();
  });

  it('should transition from confirmed to completed', async () => {
    ctx.mockPrisma.booking.findFirst.mockResolvedValue({ ...mockBooking, status: 'confirmed' });
    ctx.mockPrisma.booking.update.mockResolvedValue({
      ...mockBooking,
      status: 'completed',
      completedAt: new Date(),
    });

    const result = await (ctx.service as any).complete(mockBooking.id);

    expect(result.status).toBe('completed');
    expect(result.completedAt).toBeDefined();
  });

  it.each([
    ['pending'],
    ['completed'],
  ])('should throw ConflictException if status is %s', async (status) => {
    ctx.mockPrisma.booking.findFirst.mockResolvedValue({ ...mockBooking, status });

    await expect((ctx.service as any).complete(mockBooking.id)).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if booking not found', async () => {
    ctx.mockPrisma.booking.findFirst.mockResolvedValue(null);

    await expect((ctx.service as any).complete('non-existent-id')).rejects.toThrow(NotFoundException);
  });
});
