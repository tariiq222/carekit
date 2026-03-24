/**
 * CareKit — BookingCancellationService Unit Tests
 *
 * Tests cancellation lifecycle: requestCancellation, approveCancellation, rejectCancellation
 * PrismaService, NotificationsService, ActivityLogService, ZoomService are mocked.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingCancellationService } from '../booking-cancellation.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { ActivityLogService } from '../../activity-log/activity-log.service.js';
import { ZoomService } from '../zoom.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  booking: { findFirst: jest.fn(), update: jest.fn() },
  payment: { update: jest.fn() },
  userRole: { findMany: jest.fn() },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

const mockNotifications = { createNotification: jest.fn().mockResolvedValue(undefined) };
const mockActivityLog = { log: jest.fn().mockResolvedValue(undefined) };
const mockZoom = { deleteMeeting: jest.fn().mockResolvedValue(undefined) };

const PATIENT_ID = 'patient-uuid-1';
const BOOKING_ID = 'booking-uuid-1';

const baseBooking = {
  id: BOOKING_ID, patientId: PATIENT_ID, practitionerId: 'practitioner-uuid-1',
  serviceId: 'service-uuid-1', type: 'clinic_visit' as const,
  date: new Date('2026-06-01'), startTime: '09:00', status: 'confirmed' as const,
  cancellationReason: null, zoomMeetingId: null, deletedAt: null,
};

const pendingCancellationBooking = {
  ...baseBooking, status: 'pending_cancellation' as const,
  cancellationReason: 'Travel plans changed',
  payment: { id: 'pay-1', totalAmount: 15000, status: 'paid' },
};

const updatedBooking = {
  ...baseBooking, status: 'pending_cancellation',
  cancellationReason: 'Travel plans changed',
  practitioner: { userId: 'prac-user-1' },
};

describe('BookingCancellationService', () => {
  let service: BookingCancellationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCancellationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: ZoomService, useValue: mockZoom },
      ],
    }).compile();
    service = module.get<BookingCancellationService>(BookingCancellationService);
    jest.clearAllMocks();
  });

  // ── requestCancellation ──────────────────────────────────────

  describe('requestCancellation', () => {
    it('should transition confirmed → pending_cancellation with reason', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(baseBooking);
      mockPrisma.booking.update.mockResolvedValue(updatedBooking);
      mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 'admin-1' }]);

      const result = await service.requestCancellation(BOOKING_ID, PATIENT_ID, 'Travel plans changed');
      expect(result.status).toBe('pending_cancellation');
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending_cancellation', cancellationReason: 'Travel plans changed' }),
        }),
      );
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(service.requestCancellation('x', PATIENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when patient is not owner', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(baseBooking);
      await expect(service.requestCancellation(BOOKING_ID, 'other-uuid')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException for non-confirmed booking', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ ...baseBooking, status: 'pending' });
      await expect(service.requestCancellation(BOOKING_ID, PATIENT_ID)).rejects.toThrow(ConflictException);
    });

    it('should notify all admin/receptionist users via Promise.all', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(baseBooking);
      mockPrisma.booking.update.mockResolvedValue(updatedBooking);
      mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 'a1' }, { userId: 'a2' }]);

      await service.requestCancellation(BOOKING_ID, PATIENT_ID, 'reason');
      expect(mockNotifications.createNotification).toHaveBeenCalledTimes(2);
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'a1', type: 'booking_cancellation_requested' }),
      );
    });
  });

  // ── approveCancellation ──────────────────────────────────────

  describe('approveCancellation', () => {
    const fullDto = { refundType: 'full' as const, adminNotes: 'OK' };
    const partialDto = { refundType: 'partial' as const, refundAmount: 7500 };
    const noneDto = { refundType: 'none' as const };

    beforeEach(() => {
      mockPrisma.booking.findFirst.mockResolvedValue(pendingCancellationBooking);
      mockPrisma.booking.update.mockResolvedValue({
        ...updatedBooking, status: 'cancelled', patientId: PATIENT_ID,
        practitioner: { userId: 'prac-user-1' },
      });
    });

    it('should cancel with full refund (refundAmount = totalAmount)', async () => {
      await service.approveCancellation(BOOKING_ID, fullDto);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled' }) }),
      );
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'refunded', refundAmount: 15000 }) }),
      );
    });

    it('should cancel with partial refund', async () => {
      await service.approveCancellation(BOOKING_ID, partialDto);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ refundAmount: 7500 }) }),
      );
    });

    it('should cancel without refund when refundType is none', async () => {
      await service.approveCancellation(BOOKING_ID, noneDto);
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when partial refund exceeds total', async () => {
      await expect(
        service.approveCancellation(BOOKING_ID, { refundType: 'partial', refundAmount: 99999 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for non-pending_cancellation', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ ...pendingCancellationBooking, status: 'confirmed' });
      await expect(service.approveCancellation(BOOKING_ID, fullDto)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(service.approveCancellation('x', fullDto)).rejects.toThrow(NotFoundException);
    });

    it('should notify patient and practitioner', async () => {
      await service.approveCancellation(BOOKING_ID, fullDto);
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: PATIENT_ID, type: 'booking_cancelled' }),
      );
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'prac-user-1', type: 'booking_cancelled' }),
      );
    });

    it('should delete Zoom meeting for video_consultation', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...pendingCancellationBooking, type: 'video_consultation', zoomMeetingId: 'zm-123',
      });
      await service.approveCancellation(BOOKING_ID, fullDto);
      expect(mockZoom.deleteMeeting).toHaveBeenCalledWith('zm-123');
    });

    it('should NOT delete Zoom meeting for clinic_visit', async () => {
      await service.approveCancellation(BOOKING_ID, fullDto);
      expect(mockZoom.deleteMeeting).not.toHaveBeenCalled();
    });

    it('should write activity log on approval', async () => {
      await service.approveCancellation(BOOKING_ID, fullDto);
      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cancel_approved', module: 'bookings', resourceId: BOOKING_ID }),
      );
    });
  });

  // ── rejectCancellation ───────────────────────────────────────

  describe('rejectCancellation', () => {
    const rejectDto = { adminNotes: 'Policy does not allow' };

    it('should restore to confirmed and clear cancellationReason', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ ...baseBooking, status: 'pending_cancellation' });
      mockPrisma.booking.update.mockResolvedValue({
        ...baseBooking, status: 'confirmed', cancellationReason: null, adminNotes: rejectDto.adminNotes,
      });
      const result = await service.rejectCancellation(BOOKING_ID, rejectDto);
      expect(result.status).toBe('confirmed');
      expect(result.cancellationReason).toBeNull();
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'confirmed', cancellationReason: null }),
        }),
      );
    });

    it('should throw ConflictException for non-pending_cancellation', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(baseBooking);
      await expect(service.rejectCancellation(BOOKING_ID, rejectDto)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(service.rejectCancellation('x', rejectDto)).rejects.toThrow(NotFoundException);
    });

    it('should write activity log on rejection', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ ...baseBooking, status: 'pending_cancellation' });
      mockPrisma.booking.update.mockResolvedValue({ ...baseBooking, status: 'confirmed' });
      await service.rejectCancellation(BOOKING_ID, rejectDto);
      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cancel_rejected', module: 'bookings', resourceId: BOOKING_ID }),
      );
    });
  });
});
