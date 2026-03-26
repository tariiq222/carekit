/**
 * BookingStatusService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatusService } from '../booking-status.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { ActivityLogService } from '../../activity-log/activity-log.service.js';
import { BookingStatusLogService } from '../booking-status-log.service.js';

const bookingId = 'booking-uuid-1';
const practitionerUserId = 'user-uuid-pract';
const practitionerId = 'pract-uuid-1';
const patientId = 'patient-uuid-1';

const makeBooking = (status: string) => ({
  id: bookingId,
  status,
  practitionerId,
  patientId,
  date: new Date('2026-05-01'),
  startTime: '09:00',
  deletedAt: null,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  booking: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  payment: { findFirst: jest.fn() },
  practitioner: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation(
    (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
  ),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockNotifications: any = {
  createNotification: jest.fn().mockResolvedValue(undefined),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockActivityLog: any = {
  log: jest.fn().mockResolvedValue(undefined),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStatusLog: any = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('BookingStatusService', () => {
  let service: BookingStatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingStatusService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: BookingStatusLogService, useValue: mockStatusLog },
      ],
    }).compile();

    service = module.get<BookingStatusService>(BookingStatusService);
    jest.clearAllMocks();
    mockActivityLog.log.mockReturnValue(Promise.resolve());
    mockStatusLog.log.mockReturnValue(Promise.resolve());
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  describe('confirm', () => {
    it('should confirm a pending booking with paid payment', async () => {
      const booking = makeBooking('pending');
      const updatedBooking = { ...booking, status: 'confirmed' };
      mockPrisma.booking.findFirst.mockResolvedValue(booking);
      mockPrisma.payment.findFirst.mockResolvedValue({ status: 'paid' });
      mockPrisma.booking.update.mockResolvedValue(updatedBooking);

      const result = await service.confirm(bookingId);

      expect(result.status).toBe('confirmed');
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: bookingId },
          data: expect.objectContaining({ status: 'confirmed' }),
        }),
      );
    });

    it('should throw ConflictException when booking is not pending', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(makeBooking('confirmed'));

      await expect(service.confirm(bookingId)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when payment not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(makeBooking('pending'));
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.confirm(bookingId)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when payment is not paid', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(makeBooking('pending'));
      mockPrisma.payment.findFirst.mockResolvedValue({ status: 'pending' });

      await expect(service.confirm(bookingId)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      await expect(service.confirm('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should send notification to patient on confirm', async () => {
      const booking = makeBooking('pending');
      mockPrisma.booking.findFirst.mockResolvedValue(booking);
      mockPrisma.payment.findFirst.mockResolvedValue({ status: 'paid' });
      mockPrisma.booking.update.mockResolvedValue({ ...booking, status: 'confirmed' });

      await service.confirm(bookingId);

      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: patientId, type: 'booking_confirmed' }),
      );
    });
  });

  describe('checkIn', () => {
    it('should check in a confirmed booking', async () => {
      const booking = makeBooking('confirmed');
      mockPrisma.booking.findFirst.mockResolvedValue(booking);
      mockPrisma.booking.update.mockResolvedValue({ ...booking, status: 'checked_in' });
      mockPrisma.practitioner.findUnique.mockResolvedValue({ userId: practitionerUserId });

      const result = await service.checkIn(bookingId);

      expect(result.status).toBe('checked_in');
    });

    it('should throw ConflictException when booking is not confirmed', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(makeBooking('pending'));

      await expect(service.checkIn(bookingId)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(service.checkIn('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('startSession', () => {
    it('should start session for the practitioner own booking', async () => {
      const booking = makeBooking('checked_in');
      mockPrisma.booking.findFirst.mockResolvedValue(booking);
      mockPrisma.practitioner.findFirst.mockResolvedValue({ id: practitionerId, userId: practitionerUserId });
      mockPrisma.booking.update.mockResolvedValue({ ...booking, status: 'in_progress' });

      const result = await service.startSession(bookingId, practitionerUserId);

      expect(result.status).toBe('in_progress');
    });

    it('should throw ForbiddenException when practitioner not matched', async () => {
      const booking = makeBooking('checked_in');
      mockPrisma.booking.findFirst.mockResolvedValue(booking);
      mockPrisma.practitioner.findFirst.mockResolvedValue({ id: 'other-pract-id', userId: practitionerUserId });

      await expect(service.startSession(bookingId, practitionerUserId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when status is not checked_in or confirmed', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(makeBooking('pending'));

      await expect(service.startSession(bookingId, practitionerUserId)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when status is confirmed (checkIn required first)', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(makeBooking('confirmed'));

      await expect(service.startSession(bookingId, practitionerUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('complete', () => {
    it('should complete an in_progress booking', async () => {
      const booking = makeBooking('in_progress');
      mockPrisma.booking.findFirst.mockResolvedValue(booking);
      mockPrisma.booking.update.mockResolvedValue({ ...booking, status: 'completed' });

      const result = await service.complete(bookingId, { completionNotes: 'Done' });

      expect(result.status).toBe('completed');
    });

    it('should throw BadRequestException when completing checked_in booking without session start', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(makeBooking('checked_in'));

      await expect(service.complete(bookingId)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when status is invalid', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(makeBooking('cancelled'));

      await expect(service.complete(bookingId)).rejects.toThrow(ConflictException);
    });
  });

  describe('markNoShow', () => {
    it('should mark a confirmed booking as no_show', async () => {
      const booking = makeBooking('confirmed');
      mockPrisma.booking.findFirst.mockResolvedValue(booking);
      mockPrisma.booking.update.mockResolvedValue({ ...booking, status: 'no_show' });

      const result = await service.markNoShow(bookingId);

      expect(result.status).toBe('no_show');
    });

    it('should throw ConflictException when booking is not confirmed', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(makeBooking('checked_in'));

      await expect(service.markNoShow(bookingId)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(service.markNoShow('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
