/**
 * BookingsService — Cancellation Tests
 * Covers: requestCancellation, approveCancellation, rejectCancellation
 */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createBookingsTestModule, BookingsTestContext } from './bookings.test-module.js';
import { mockBooking, mockPatientId } from './bookings.fixtures.js';

describe('BookingsService — requestCancellation', () => {
  let ctx: BookingsTestContext;

  beforeEach(async () => {
    ctx = await createBookingsTestModule();
    jest.clearAllMocks();
  });

  it('should transition confirmed booking to pending_cancellation', async () => {
    const result = {
      ...mockBooking,
      status: 'pending_cancellation',
      cancellationReason: 'تعارض في الجدول',
    };
    ctx.mockCancellationService.requestCancellation.mockResolvedValue(result);

    const booking = await ctx.service.requestCancellation(
      mockBooking.id,
      mockPatientId,
      'تعارض في الجدول',
    );

    expect(booking.status).toBe('pending_cancellation');
    expect(booking.cancellationReason).toBe('تعارض في الجدول');
    expect(ctx.mockCancellationService.requestCancellation).toHaveBeenCalledWith(
      mockBooking.id,
      mockPatientId,
      'تعارض في الجدول',
    );
  });

  it.each([
    ['ForbiddenException if patient is not the owner', ForbiddenException, 'different-patient-id'],
  ])('should throw %s', async (_label, Exception, patientId) => {
    ctx.mockCancellationService.requestCancellation.mockRejectedValue(
      new Exception({ statusCode: 403, message: 'Forbidden', error: 'FORBIDDEN' }),
    );

    await expect(
      ctx.service.requestCancellation(mockBooking.id, patientId, 'test'),
    ).rejects.toThrow(Exception);
  });

  it.each([
    ['pending_cancellation', 'already pending_cancellation'],
    ['cancelled', 'already cancelled'],
  ])('should throw ConflictException if status is %s', async (status) => {
    ctx.mockCancellationService.requestCancellation.mockRejectedValue(
      new ConflictException({
        statusCode: 409,
        message: `Cannot request cancellation for booking with status '${status}'`,
        error: 'CONFLICT',
      }),
    );

    await expect(
      ctx.service.requestCancellation(mockBooking.id, mockPatientId, 'reason'),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if booking not found', async () => {
    ctx.mockCancellationService.requestCancellation.mockRejectedValue(
      new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' }),
    );

    await expect(
      ctx.service.requestCancellation('non-existent-id', mockPatientId, 'test'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('BookingsService — approveCancellation', () => {
  let ctx: BookingsTestContext;

  const approveDto = { refundType: 'full' as const, adminNotes: 'Approved per clinic policy' };

  beforeEach(async () => {
    ctx = await createBookingsTestModule();
    jest.clearAllMocks();
  });

  it('should transition pending_cancellation to cancelled', async () => {
    ctx.mockCancellationService.approveCancellation.mockResolvedValue({
      ...mockBooking,
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    const result = await ctx.service.approveCancellation(mockBooking.id, approveDto);

    expect(result.status).toBe('cancelled');
    expect(result.cancelledAt).toBeDefined();
    expect(ctx.mockCancellationService.approveCancellation).toHaveBeenCalledWith(
      mockBooking.id,
      approveDto,
    );
  });

  it.each(['full', 'partial', 'none'] as const)(
    'should accept refundType=%s',
    async (refundType) => {
      ctx.mockCancellationService.approveCancellation.mockResolvedValue({
        ...mockBooking,
        status: 'cancelled',
        cancelledAt: new Date(),
      });

      const result = await ctx.service.approveCancellation(mockBooking.id, {
        refundType,
        adminNotes: `${refundType} refund`,
      });

      expect(result.status).toBe('cancelled');
    },
  );

  it('should throw ConflictException if not in pending_cancellation state', async () => {
    ctx.mockCancellationService.approveCancellation.mockRejectedValue(
      new ConflictException({
        statusCode: 409,
        message: "Cannot approve cancellation for booking with status 'confirmed'",
        error: 'CONFLICT',
      }),
    );

    await expect(
      ctx.service.approveCancellation(mockBooking.id, approveDto),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if booking not found', async () => {
    ctx.mockCancellationService.approveCancellation.mockRejectedValue(
      new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' }),
    );

    await expect(
      ctx.service.approveCancellation('non-existent-id', approveDto),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('BookingsService — rejectCancellation', () => {
  let ctx: BookingsTestContext;

  beforeEach(async () => {
    ctx = await createBookingsTestModule();
    jest.clearAllMocks();
  });

  it('should transition pending_cancellation back to confirmed', async () => {
    ctx.mockCancellationService.rejectCancellation.mockResolvedValue({
      ...mockBooking,
      status: 'confirmed',
      cancellationReason: null,
    });

    const result = await ctx.service.rejectCancellation(mockBooking.id, {
      adminNotes: 'Cannot cancel within 24 hours',
    });

    expect(result.status).toBe('confirmed');
    expect(ctx.mockCancellationService.rejectCancellation).toHaveBeenCalledWith(
      mockBooking.id,
      { adminNotes: 'Cannot cancel within 24 hours' },
    );
  });

  it('should throw ConflictException if not in pending_cancellation state', async () => {
    ctx.mockCancellationService.rejectCancellation.mockRejectedValue(
      new ConflictException({
        statusCode: 409,
        message: "Cannot reject cancellation for booking with status 'confirmed'",
        error: 'CONFLICT',
      }),
    );

    await expect(
      ctx.service.rejectCancellation(mockBooking.id, {}),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if booking not found', async () => {
    ctx.mockCancellationService.rejectCancellation.mockRejectedValue(
      new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' }),
    );

    await expect(
      ctx.service.rejectCancellation('non-existent-id', {}),
    ).rejects.toThrow(NotFoundException);
  });
});
