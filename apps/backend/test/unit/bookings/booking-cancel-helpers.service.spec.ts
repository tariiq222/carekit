/**
 * BookingCancelHelpersService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingCancelHelpersService } from '../../../src/modules/bookings/booking-cancel-helpers.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { MessagingDispatcherService } from '../../../src/modules/messaging/core/messaging-dispatcher.service.js';
import { MessagingEvent } from '../../../src/modules/messaging/core/messaging-events.js';
import { ZoomService } from '../../../src/modules/integrations/zoom/zoom.service.js';

const bookingId = 'booking-uuid-1';
const patientId = 'patient-uuid-1';

const makeSettings = (overrides = {}) => ({
  freeCancelBeforeHours: 24,
  freeCancelRefundType: 'full',
  lateCancelRefundType: 'none',
  ...overrides,
});

const mockTx: any = {
  payment: { update: jest.fn().mockResolvedValue({}) },
};

const mockPrisma: any = {
  userRole: { findMany: jest.fn().mockResolvedValue([]) },
};

const mockMessagingDispatcher = {
  dispatch: jest.fn().mockResolvedValue(undefined),
};

const mockZoom: any = {
  deleteMeeting: jest.fn().mockResolvedValue(undefined),
};

const mockConfig: any = {
  get: jest.fn().mockReturnValue('test-api-key'),
};

describe('BookingCancelHelpersService', () => {
  let service: BookingCancelHelpersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCancelHelpersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MessagingDispatcherService, useValue: mockMessagingDispatcher },
        { provide: ZoomService, useValue: mockZoom },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<BookingCancelHelpersService>(
      BookingCancelHelpersService,
    );
    jest.clearAllMocks();
    mockMessagingDispatcher.dispatch.mockResolvedValue(undefined);
  });

  describe('calculateSuggestedRefund', () => {
    it('should return freeCancelRefundType when cancellation is early enough', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const booking: any = {
        date: futureDate,
        startTime: '10:00',
      };

      const result = service.calculateSuggestedRefund(
        booking,
        makeSettings() as Parameters<
          typeof service.calculateSuggestedRefund
        >[1],
      );
      expect(result).toBe('full');
    });

    it('should return lateCancelRefundType when cancellation is too late', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const booking: any = {
        date: pastDate,
        startTime: '10:00',
      };

      const result = service.calculateSuggestedRefund(
        booking,
        makeSettings() as Parameters<
          typeof service.calculateSuggestedRefund
        >[1],
      );
      expect(result).toBe('none');
    });
  });

  describe('validatePartialRefund', () => {
    it('should not throw when refundType is not partial', () => {
      expect(() =>
        service.validatePartialRefund(
          {
            refundType: 'full' as Parameters<
              typeof service.validatePartialRefund
            >[0]['refundType'],
          },
          null,
        ),
      ).not.toThrow();
    });

    it('should throw BadRequestException when partial but no refundAmount', () => {
      expect(() =>
        service.validatePartialRefund(
          {
            refundType: 'partial' as Parameters<
              typeof service.validatePartialRefund
            >[0]['refundType'],
          },
          { totalAmount: 10000 },
        ),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException when refundAmount exceeds totalAmount', () => {
      expect(() =>
        service.validatePartialRefund(
          {
            refundType: 'partial' as Parameters<
              typeof service.validatePartialRefund
            >[0]['refundType'],
            refundAmount: 15000,
          },
          { totalAmount: 10000 },
        ),
      ).toThrow(BadRequestException);
    });

    it('should not throw when valid partial refund', () => {
      expect(() =>
        service.validatePartialRefund(
          {
            refundType: 'partial' as Parameters<
              typeof service.validatePartialRefund
            >[0]['refundType'],
            refundAmount: 5000,
          },
          { totalAmount: 10000 },
        ),
      ).not.toThrow();
    });
  });

  describe('processRefund', () => {
    const paidPayment = {
      id: 'pay-1',
      status: 'paid',
      totalAmount: 10000,
      method: 'bank_transfer',
      moyasarPaymentId: null,
    };

    it('should skip refund when refundType is none', async () => {
      await service.processRefund(
        mockTx,
        'none' as Parameters<typeof service.processRefund>[1],
        paidPayment,
      );
      expect(mockTx.payment.update).not.toHaveBeenCalled();
    });

    it('should skip refund when payment is null', async () => {
      await service.processRefund(
        mockTx,
        'full' as Parameters<typeof service.processRefund>[1],
        null,
      );
      expect(mockTx.payment.update).not.toHaveBeenCalled();
    });

    it('should skip refund when payment status is not paid', async () => {
      await service.processRefund(
        mockTx,
        'full' as Parameters<typeof service.processRefund>[1],
        { ...paidPayment, status: 'pending' },
      );
      expect(mockTx.payment.update).not.toHaveBeenCalled();
    });

    it('should process full refund', async () => {
      mockTx.payment.update.mockResolvedValue({});
      await service.processRefund(
        mockTx,
        'full' as Parameters<typeof service.processRefund>[1],
        paidPayment,
      );
      expect(mockTx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'refunded', refundAmount: 10000 },
        }),
      );
    });

    it('should process partial refund with given amount', async () => {
      mockTx.payment.update.mockResolvedValue({});
      await service.processRefund(
        mockTx,
        'partial' as Parameters<typeof service.processRefund>[1],
        paidPayment,
        5000,
      );
      expect(mockTx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'refunded', refundAmount: 5000 },
        }),
      );
    });
  });

  describe('notifyPatientCancelled', () => {
    it('should send notification to patient', async () => {
      await service.notifyPatientCancelled(
        { patientId, id: bookingId },
        'admin',
      );
      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: patientId,
          event: MessagingEvent.BOOKING_CANCELLED,
        }),
      );
    });

    it('should skip when patientId is null', async () => {
      await service.notifyPatientCancelled(
        { patientId: null, id: bookingId },
        'admin',
      );
      expect(mockMessagingDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('notifyPractitionerCancelled', () => {
    it('should send notification to practitioner', async () => {
      await service.notifyPractitionerCancelled({
        practitioner: { userId: 'pract-user-id' },
        date: new Date('2026-05-01'),
        startTime: '10:00',
        id: bookingId,
      });
      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'pract-user-id',
          event: MessagingEvent.BOOKING_CANCELLED,
        }),
      );
    });

    it('should skip when practitioner userId is missing', async () => {
      await service.notifyPractitionerCancelled({
        practitioner: null,
        date: new Date('2026-05-01'),
        startTime: '10:00',
        id: bookingId,
      });
      expect(mockMessagingDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('notifyAdmins', () => {
    it('should notify all admin users', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([
        { userId: 'admin-1' },
        { userId: 'admin-2' },
      ]);

      await service.notifyAdmins(
        'titleAr',
        'titleEn',
        'bodyAr',
        'bodyEn',
        'test_event',
        {},
      );

      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledTimes(2);
    });

    it('should skip when no admins found', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      await service.notifyAdmins('t', 'e', 'b', 'e', 'event', {});
      expect(mockMessagingDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('deleteZoomIfNeeded', () => {
    it('should delete Zoom meeting for online type', () => {
      service.deleteZoomIfNeeded({ type: 'online', zoomMeetingId: 'zoom-123' });
      expect(mockZoom.deleteMeeting).toHaveBeenCalledWith('zoom-123');
    });

    it('should skip when not online', () => {
      service.deleteZoomIfNeeded({
        type: 'in_person',
        zoomMeetingId: 'zoom-123',
      });
      expect(mockZoom.deleteMeeting).not.toHaveBeenCalled();
    });

    it('should skip when zoomMeetingId is null', () => {
      service.deleteZoomIfNeeded({ type: 'online', zoomMeetingId: null });
      expect(mockZoom.deleteMeeting).not.toHaveBeenCalled();
    });
  });
});
