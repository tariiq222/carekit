/**
 * BookingPaymentHelper Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BookingPaymentHelper } from '../../../src/modules/bookings/booking-payment.helper.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';

const callerUserId = 'user-uuid-caller';
const targetPatientId = 'patient-uuid-1';
const bookingId = 'booking-uuid-1';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: { findFirst: jest.fn() },
  payment: { create: jest.fn().mockResolvedValue({ id: 'pay-uuid' }) },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSettings: any = {
  get: jest.fn().mockResolvedValue({ walkInPaymentRequired: true }),
};

describe('BookingPaymentHelper', () => {
  let service: BookingPaymentHelper;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingPaymentHelper,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingSettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get<BookingPaymentHelper>(BookingPaymentHelper);
    jest.clearAllMocks();
    mockSettings.get.mockResolvedValue({ walkInPaymentRequired: true });
  });

  describe('resolvePatientId', () => {
    it('should return callerUserId when no target provided', async () => {
      const result = await service.resolvePatientId(callerUserId);
      expect(result).toBe(callerUserId);
    });

    it('should return callerUserId when target equals caller', async () => {
      const result = await service.resolvePatientId(callerUserId, callerUserId);
      expect(result).toBe(callerUserId);
    });

    it('should return targetPatientId when patient exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: targetPatientId });
      const result = await service.resolvePatientId(callerUserId, targetPatientId);
      expect(result).toBe(targetPatientId);
    });

    it('should throw NotFoundException when target patient not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.resolvePatientId(callerUserId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPaymentIfNeeded', () => {
    it('should create cash payment when payAtClinic is true and caller has privilege', async () => {
      const staffRoles = [{ slug: 'staff' }];
      await service.createPaymentIfNeeded(bookingId, 'clinic_visit', 20000, true, staffRoles);
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ method: 'cash', status: 'paid' }),
        }),
      );
    });

    it('should throw ForbiddenException when payAtClinic is true but caller lacks privilege', async () => {
      await expect(
        service.createPaymentIfNeeded(bookingId, 'clinic_visit', 20000, true, [{ slug: 'patient' }]),
      ).rejects.toMatchObject({ response: { statusCode: 403, error: 'FORBIDDEN' } });
      await expect(
        service.createPaymentIfNeeded(bookingId, 'clinic_visit', 20000, true, undefined),
      ).rejects.toMatchObject({ response: { statusCode: 403, error: 'FORBIDDEN' } });
    });

    it('should skip payment when resolvedPrice is 0 (free service)', async () => {
      await service.createPaymentIfNeeded(bookingId, 'clinic_visit', 0);
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('should create moyasar payment for normal bookings', async () => {
      await service.createPaymentIfNeeded(bookingId, 'clinic_visit', 20000);
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ method: 'moyasar', status: 'awaiting' }),
        }),
      );
    });

    it('should skip payment for walk_in when walkInPaymentRequired is false', async () => {
      mockSettings.get.mockResolvedValue({ walkInPaymentRequired: false });
      await service.createPaymentIfNeeded(bookingId, 'walk_in', 20000);
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('should create payment for walk_in when walkInPaymentRequired is true', async () => {
      mockSettings.get.mockResolvedValue({ walkInPaymentRequired: true });
      await service.createPaymentIfNeeded(bookingId, 'walk_in', 20000);
      expect(mockPrisma.payment.create).toHaveBeenCalled();
    });

    it('should calculate VAT (15%) on top of resolvedPrice', async () => {
      await service.createPaymentIfNeeded(bookingId, 'clinic_visit', 20000);
      const createCall = mockPrisma.payment.create.mock.calls[0][0];
      expect(createCall.data.amount).toBe(20000);
      expect(createCall.data.vatAmount).toBe(3000);
      expect(createCall.data.totalAmount).toBe(23000);
    });
  });
});
