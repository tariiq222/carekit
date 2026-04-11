/**
 * CareKit — BookingCancellationService Unit Tests
 *
 * Tests cancellation lifecycle: requestCancellation, approveCancellation,
 * rejectCancellation, adminDirectCancel, practitionerCancel.
 * Dependencies are mocked.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingCancellationService } from '../../../src/modules/bookings/booking-cancellation.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { BookingCancelHelpersService } from '../../../src/modules/bookings/booking-cancel-helpers.service.js';
import { BookingLookupHelper } from '../../../src/modules/bookings/booking-lookup.helper.js';
import { WaitlistService } from '../../../src/modules/bookings/waitlist.service.js';
import { RefundType, CancelledBy } from '@prisma/client';

const mockPrisma: any = {
  booking: { findFirst: jest.fn(), update: jest.fn() },
  payment: { update: jest.fn(), deleteMany: jest.fn() },
  userRole: { findMany: jest.fn() },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  ),
};

const mockActivityLog = { log: jest.fn().mockResolvedValue(undefined) };

const defaultSettings = {
  patientCanCancelPending: true,
  freeCancelBeforeHours: 24,
  freeCancelRefundType: RefundType.full,
  lateCancelRefundType: RefundType.none,
};
const mockBookingSettings = {
  get: jest.fn().mockResolvedValue(defaultSettings),
};

const mockHelpers = {
  calculateSuggestedRefund: jest.fn().mockReturnValue(RefundType.full),
  validatePartialRefund: jest.fn(),
  processRefund: jest.fn().mockResolvedValue(undefined),
  notifyPatientCancelled: jest.fn().mockResolvedValue(undefined),
  notifyPractitionerCancelled: jest.fn().mockResolvedValue(undefined),
  notifyPatientPractitionerCancelled: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
  notifyPatientCancellationRejected: jest.fn().mockResolvedValue(undefined),
  deleteZoomIfNeeded: jest.fn(),
};

const PATIENT_ID = 'patient-uuid-1';
const BOOKING_ID = 'booking-uuid-1';
const ADMIN_ID = 'admin-uuid-1';
const PRAC_USER_ID = 'prac-user-1';

const baseBooking = {
  id: BOOKING_ID,
  patientId: PATIENT_ID,
  practitionerId: 'practitioner-uuid-1',
  serviceId: 'service-uuid-1',
  type: 'in_person' as const,
  date: new Date('2026-06-01'),
  startTime: '09:00',
  status: 'confirmed' as const,
  cancellationReason: null,
  zoomMeetingId: null,
  deletedAt: null,
};

const pendingBooking = { ...baseBooking, status: 'pending' as const };

const pendingCancellationBooking = {
  ...baseBooking,
  status: 'pending_cancellation' as const,
  cancellationReason: 'Travel plans changed',
  payment: { id: 'pay-1', totalAmount: 15000, status: 'paid' },
};

const updatedBooking = {
  ...baseBooking,
  status: 'pending_cancellation',
  cancellationReason: 'Travel plans changed',
  practitioner: { userId: PRAC_USER_ID },
};

describe('BookingCancellationService', () => {
  let service: BookingCancellationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCancellationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: BookingSettingsService, useValue: mockBookingSettings },
        { provide: BookingCancelHelpersService, useValue: mockHelpers },
        {
          provide: BookingLookupHelper,
          useValue: {
            findBookingOrFail: jest
              .fn()
              .mockImplementation(async (id: string) => {
                const b = await mockPrisma.booking.findFirst({
                  where: { id, deletedAt: null },
                });
                if (!b)
                  throw new NotFoundException({
                    statusCode: 404,
                    message: 'Booking not found',
                    error: 'NOT_FOUND',
                  });
                return b;
              }),
            findWithPayment: jest
              .fn()
              .mockImplementation(async (id: string) => {
                const b = await mockPrisma.booking.findFirst({
                  where: { id, deletedAt: null },
                });
                if (!b)
                  throw new NotFoundException({
                    statusCode: 404,
                    message: 'Booking not found',
                    error: 'NOT_FOUND',
                  });
                return b;
              }),
            findWithRelations: jest
              .fn()
              .mockImplementation(async (id: string) => {
                const b = await mockPrisma.booking.findFirst({
                  where: { id, deletedAt: null },
                });
                if (!b)
                  throw new NotFoundException({
                    statusCode: 404,
                    message: 'Booking not found',
                    error: 'NOT_FOUND',
                  });
                return b;
              }),
            assertCancellable: jest
              .fn()
              .mockImplementation((booking: { status: string }) => {
                const nonCancellable = [
                  'completed',
                  'cancelled',
                  'expired',
                  'no_show',
                ];
                if (nonCancellable.includes(booking.status)) {
                  throw new ConflictException({
                    statusCode: 409,
                    message: `Cannot cancel booking with status '${booking.status}'`,
                    error: 'CONFLICT',
                  });
                }
              }),
            assertPatientOwnership: jest
              .fn()
              .mockImplementation(
                (booking: { patientId: string }, patientId: string) => {
                  if (booking.patientId !== patientId) {
                    throw new ForbiddenException({
                      statusCode: 403,
                      message: 'Forbidden',
                      error: 'FORBIDDEN',
                    });
                  }
                },
              ),
            assertPractitionerOwnership: jest
              .fn()
              .mockImplementation(
                (
                  booking: { practitioner?: { userId: string } },
                  practitionerUserId: string,
                ) => {
                  if (booking.practitioner?.userId !== practitionerUserId) {
                    throw new ForbiddenException({
                      statusCode: 403,
                      message: 'Forbidden',
                      error: 'FORBIDDEN',
                    });
                  }
                },
              ),
          },
        },
        {
          provide: WaitlistService,
          useValue: { checkAndNotify: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    service = module.get<BookingCancellationService>(
      BookingCancellationService,
    );
    jest.clearAllMocks();
    mockBookingSettings.get.mockResolvedValue(defaultSettings);
  });

  // ── requestCancellation ──────────────────────────────────────

  describe('requestCancellation', () => {
    it('should transition confirmed → pending_cancellation with reason', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(baseBooking);
      mockPrisma.booking.update.mockResolvedValue(updatedBooking);

      const result = await service.requestCancellation(
        BOOKING_ID,
        PATIENT_ID,
        'Travel plans changed',
      );
      expect(result.status).toBe('pending_cancellation');
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending_cancellation',
            cancellationReason: 'Travel plans changed',
          }),
        }),
      );
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(
        service.requestCancellation('x', PATIENT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when patient is not owner', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(baseBooking);
      await expect(
        service.requestCancellation(BOOKING_ID, 'other-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should notify admins via helpers on confirmed cancel request', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(baseBooking);
      mockPrisma.booking.update.mockResolvedValue(updatedBooking);

      await service.requestCancellation(BOOKING_ID, PATIENT_ID, 'reason');
      expect(mockHelpers.notifyAdmins).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'booking_cancellation_requested',
        expect.objectContaining({ bookingId: BOOKING_ID }),
      );
    });

    it('should save suggestedRefundType from calculateSuggestedRefund', async () => {
      mockHelpers.calculateSuggestedRefund.mockReturnValue(RefundType.none);
      mockPrisma.booking.findFirst.mockResolvedValue(baseBooking);
      mockPrisma.booking.update.mockResolvedValue(updatedBooking);

      await service.requestCancellation(BOOKING_ID, PATIENT_ID, 'reason');
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            suggestedRefundType: RefundType.none,
          }),
        }),
      );
    });

    // Fix 1: Pending booking cancel
    it('should directly cancel pending booking when settings allow', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(pendingBooking);
      mockPrisma.booking.update.mockResolvedValue({
        ...pendingBooking,
        status: 'cancelled',
      });

      const result = await service.requestCancellation(BOOKING_ID, PATIENT_ID);
      expect(result.status).toBe('cancelled');
      expect(mockPrisma.payment.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            bookingId: BOOKING_ID,
            status: { in: ['awaiting', 'pending'] },
          }),
        }),
      );
    });

    it('should throw ConflictException for pending booking when settings disallow', async () => {
      mockBookingSettings.get.mockResolvedValue({
        ...defaultSettings,
        patientCanCancelPending: false,
      });
      mockPrisma.booking.findFirst.mockResolvedValue(pendingBooking);
      await expect(
        service.requestCancellation(BOOKING_ID, PATIENT_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for non-confirmed/non-pending status', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        status: 'completed',
      });
      await expect(
        service.requestCancellation(BOOKING_ID, PATIENT_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── approveCancellation ──────────────────────────────────────

  describe('approveCancellation', () => {
    const fullDto = { refundType: RefundType.full, adminNotes: 'OK' };
    const noneDto = { refundType: RefundType.none };

    beforeEach(() => {
      mockPrisma.booking.findFirst.mockResolvedValue(
        pendingCancellationBooking,
      );
      mockPrisma.booking.update.mockResolvedValue({
        ...updatedBooking,
        status: 'cancelled',
        patientId: PATIENT_ID,
        practitioner: { userId: PRAC_USER_ID },
      });
    });

    it('should cancel with full refund', async () => {
      await service.approveCancellation(BOOKING_ID, fullDto);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'cancelled' }),
        }),
      );
      expect(mockHelpers.processRefund).toHaveBeenCalledWith(
        mockPrisma,
        RefundType.full,
        pendingCancellationBooking.payment,
        undefined,
      );
    });

    it('should cancel without refund when refundType is none', async () => {
      await service.approveCancellation(BOOKING_ID, noneDto);
      expect(mockHelpers.processRefund).toHaveBeenCalledWith(
        mockPrisma,
        RefundType.none,
        pendingCancellationBooking.payment,
        undefined,
      );
    });

    it('should throw ConflictException for non-pending_cancellation', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...pendingCancellationBooking,
        status: 'confirmed',
      });
      await expect(
        service.approveCancellation(BOOKING_ID, fullDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(service.approveCancellation('x', fullDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should notify patient and practitioner via helpers', async () => {
      await service.approveCancellation(BOOKING_ID, fullDto);
      expect(mockHelpers.notifyPatientCancelled).toHaveBeenCalled();
      expect(mockHelpers.notifyPractitionerCancelled).toHaveBeenCalled();
    });

    it('should delete Zoom meeting via helpers', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...pendingCancellationBooking,
        type: 'online',
        zoomMeetingId: 'zm-123',
      });
      await service.approveCancellation(BOOKING_ID, fullDto);
      expect(mockHelpers.deleteZoomIfNeeded).toHaveBeenCalled();
    });

    it('should write activity log on approval', async () => {
      await service.approveCancellation(BOOKING_ID, fullDto);
      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel_approved',
          module: 'bookings',
          resourceId: BOOKING_ID,
        }),
      );
    });
  });

  // ── rejectCancellation ───────────────────────────────────────

  describe('rejectCancellation', () => {
    const rejectDto = { adminNotes: 'Policy does not allow' };

    it('should restore to confirmed and clear cancellationReason', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        status: 'pending_cancellation',
      });
      mockPrisma.booking.update.mockResolvedValue({
        ...baseBooking,
        status: 'confirmed',
        cancellationReason: null,
        adminNotes: rejectDto.adminNotes,
      });
      const result = await service.rejectCancellation(BOOKING_ID, rejectDto);
      expect(result.status).toBe('confirmed');
      expect(result.cancellationReason).toBeNull();
    });

    it('should throw ConflictException for non-pending_cancellation', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(baseBooking);
      await expect(
        service.rejectCancellation(BOOKING_ID, rejectDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(service.rejectCancellation('x', rejectDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should write activity log on rejection', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        status: 'pending_cancellation',
      });
      mockPrisma.booking.update.mockResolvedValue({
        ...baseBooking,
        status: 'confirmed',
      });
      await service.rejectCancellation(BOOKING_ID, rejectDto);
      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel_rejected',
          module: 'bookings',
          resourceId: BOOKING_ID,
        }),
      );
    });
  });

  // ── adminDirectCancel ────────────────────────────────────────

  describe('adminDirectCancel', () => {
    const dto = {
      refundType: RefundType.full,
      reason: 'Admin decision',
      adminNotes: 'Noted',
    };

    it('should cancel booking and process refund', async () => {
      const bookingWithPay = {
        ...baseBooking,
        payment: { id: 'pay-1', totalAmount: 15000, status: 'paid' },
      };
      mockPrisma.booking.findFirst.mockResolvedValue(bookingWithPay);
      mockPrisma.booking.update.mockResolvedValue({
        ...bookingWithPay,
        status: 'cancelled',
      });

      const result = await service.adminDirectCancel(BOOKING_ID, ADMIN_ID, dto);
      expect(result.status).toBe('cancelled');
      expect(mockHelpers.processRefund).toHaveBeenCalled();
      expect(mockHelpers.notifyPatientCancelled).toHaveBeenCalled();
      expect(mockHelpers.notifyPractitionerCancelled).toHaveBeenCalled();
    });

    it('should set cancelledBy to admin', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        payment: null,
      });
      mockPrisma.booking.update.mockResolvedValue({
        ...baseBooking,
        status: 'cancelled',
      });

      await service.adminDirectCancel(BOOKING_ID, ADMIN_ID, dto);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancelledBy: CancelledBy.admin }),
        }),
      );
    });

    it('should throw ConflictException for completed booking', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        status: 'completed',
        payment: null,
      });
      await expect(
        service.adminDirectCancel(BOOKING_ID, ADMIN_ID, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should log activity with admin userId', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        payment: null,
      });
      mockPrisma.booking.update.mockResolvedValue({
        ...baseBooking,
        status: 'cancelled',
      });

      await service.adminDirectCancel(BOOKING_ID, ADMIN_ID, dto);
      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: ADMIN_ID,
          action: 'admin_direct_cancel',
        }),
      );
    });
  });

  // ── practitionerCancel ───────────────────────────────────────

  describe('practitionerCancel', () => {
    const bookingWithRels = {
      ...baseBooking,
      practitioner: { userId: PRAC_USER_ID },
      payment: { id: 'pay-1', totalAmount: 15000, status: 'paid' },
    };

    it('should cancel with full refund and notify', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(bookingWithRels);
      mockPrisma.booking.update.mockResolvedValue({
        ...bookingWithRels,
        status: 'cancelled',
      });

      const result = await service.practitionerCancel(
        BOOKING_ID,
        PRAC_USER_ID,
        'Emergency',
      );
      expect(result.status).toBe('cancelled');
      expect(mockHelpers.processRefund).toHaveBeenCalledWith(
        mockPrisma,
        RefundType.full,
        bookingWithRels.payment,
      );
      expect(mockHelpers.notifyPatientPractitionerCancelled).toHaveBeenCalled();
      expect(mockHelpers.notifyAdmins).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if practitioner does not own booking', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(bookingWithRels);
      await expect(
        service.practitionerCancel(BOOKING_ID, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException for completed booking', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...bookingWithRels,
        status: 'completed',
      });
      await expect(
        service.practitionerCancel(BOOKING_ID, PRAC_USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('should log activity with practitioner userId', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(bookingWithRels);
      mockPrisma.booking.update.mockResolvedValue({
        ...bookingWithRels,
        status: 'cancelled',
      });

      await service.practitionerCancel(BOOKING_ID, PRAC_USER_ID);
      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: PRAC_USER_ID,
          action: 'practitioner_cancel',
        }),
      );
    });
  });
});
