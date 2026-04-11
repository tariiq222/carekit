/**
 * BookingLookupHelper Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingLookupHelper } from '../../../src/modules/bookings/booking-lookup.helper.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const bookingId = 'booking-uuid-1';
const patientId = 'patient-uuid-1';
const practitionerUserId = 'user-uuid-pract';

const mockBooking = {
  id: bookingId,
  status: 'pending',
  patientId,
  practitionerId: 'pract-uuid-1',
  deletedAt: null,
  practitioner: { id: 'pract-uuid-1', userId: practitionerUserId },
  payment: null,
};

const mockPrisma: any = {
  booking: { findFirst: jest.fn() },
};

describe('BookingLookupHelper', () => {
  let helper: BookingLookupHelper;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingLookupHelper,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    helper = module.get<BookingLookupHelper>(BookingLookupHelper);
    jest.clearAllMocks();
  });

  describe('findOrFail', () => {
    it('should return booking when found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);

      const result = await helper.findOrFail(bookingId);

      expect(result.id).toBe(bookingId);
      expect(mockPrisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: bookingId, deletedAt: null } }),
      );
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      await expect(helper.findOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should pass include option when provided', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        payment: null,
      });

      await helper.findOrFail(bookingId, { payment: true });

      expect(mockPrisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ include: { payment: true } }),
      );
    });
  });

  describe('findBookingOrFail (deprecated)', () => {
    it('should delegate to findOrFail', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
      const result = await helper.findBookingOrFail(bookingId);
      expect(result.id).toBe(bookingId);
    });
  });

  describe('findWithPayment (deprecated)', () => {
    it('should return booking with payment included', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
      const result = await helper.findWithPayment(bookingId);
      expect(result.id).toBe(bookingId);
    });
  });

  describe('findWithRelations (deprecated)', () => {
    it('should return booking with payment and practitioner', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
      const result = await helper.findWithRelations(bookingId);
      expect(result.id).toBe(bookingId);
    });
  });

  describe('assertCancellable', () => {
    it('should not throw for pending booking', () => {
      expect(() =>
        helper.assertCancellable({
          ...mockBooking,
          status: 'pending',
        } as Parameters<typeof helper.assertCancellable>[0]),
      ).not.toThrow();
    });

    it('should not throw for confirmed booking', () => {
      expect(() =>
        helper.assertCancellable({
          ...mockBooking,
          status: 'confirmed',
        } as Parameters<typeof helper.assertCancellable>[0]),
      ).not.toThrow();
    });

    it('should throw ConflictException for completed booking', () => {
      expect(() =>
        helper.assertCancellable({
          ...mockBooking,
          status: 'completed',
        } as Parameters<typeof helper.assertCancellable>[0]),
      ).toThrow(ConflictException);
    });

    it('should throw ConflictException for cancelled booking', () => {
      expect(() =>
        helper.assertCancellable({
          ...mockBooking,
          status: 'cancelled',
        } as Parameters<typeof helper.assertCancellable>[0]),
      ).toThrow(ConflictException);
    });

    it('should throw ConflictException for in_progress booking', () => {
      expect(() =>
        helper.assertCancellable({
          ...mockBooking,
          status: 'in_progress',
        } as Parameters<typeof helper.assertCancellable>[0]),
      ).toThrow(ConflictException);
    });
  });

  describe('assertPatientOwnership', () => {
    it('should not throw when patientId matches', () => {
      expect(() =>
        helper.assertPatientOwnership({ patientId }, patientId),
      ).not.toThrow();
    });

    it('should throw ForbiddenException when patientId does not match', () => {
      expect(() =>
        helper.assertPatientOwnership(
          { patientId: 'other-patient' },
          patientId,
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('assertPractitionerOwnership', () => {
    it('should not throw when practitioner userId matches', () => {
      expect(() =>
        helper.assertPractitionerOwnership(
          { practitioner: { userId: practitionerUserId } },
          practitionerUserId,
        ),
      ).not.toThrow();
    });

    it('should throw ForbiddenException when practitioner userId does not match', () => {
      expect(() =>
        helper.assertPractitionerOwnership(
          { practitioner: { userId: 'other-user' } },
          practitionerUserId,
        ),
      ).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when practitioner is null', () => {
      expect(() =>
        helper.assertPractitionerOwnership(
          { practitioner: null },
          practitionerUserId,
        ),
      ).toThrow(ForbiddenException);
    });
  });
});
