/**
 * BookingQueryService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingQueryService } from '../../../src/modules/bookings/booking-query.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const patientId = 'patient-uuid-1';
const practitionerId = 'pract-uuid-1';
const bookingId = 'booking-uuid-1';
const userId = 'user-uuid-1';

const makeBooking = (overrides = {}) => ({
  id: bookingId,
  status: 'confirmed',
  date: new Date('2026-05-01'),
  startTime: '10:00',
  endTime: '10:30',
  patientId,
  practitionerId,
  deletedAt: null,
  zoomMeetingId: null,
  ...overrides,
});

const mockPrisma: any = {
  booking: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  user: {
    findUnique: jest.fn(),
  },
  practitioner: {
    findFirst: jest.fn(),
  },
  practitionerAvailability: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

describe('BookingQueryService', () => {
  let service: BookingQueryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingQueryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BookingQueryService>(BookingQueryService);
    jest.clearAllMocks();
    mockPrisma.booking.count.mockResolvedValue(0);
    mockPrisma.booking.findMany.mockResolvedValue([]);
    mockPrisma.booking.groupBy.mockResolvedValue([]);
    mockPrisma.practitionerAvailability.findMany.mockResolvedValue([]);
  });

  describe('findAll', () => {
    it('should return items and meta', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([makeBooking()]);
      mockPrisma.booking.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.meta).toBeDefined();
      expect(result.meta.total).toBe(1);
    });

    it('should strip deletedAt and zoomMeetingId from items', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([makeBooking()]);
      mockPrisma.booking.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items[0]).not.toHaveProperty('deletedAt');
      expect(result.items[0]).not.toHaveProperty('zoomMeetingId');
    });

    it('should apply status filter', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await service.findAll({
        status: 'confirmed' as Parameters<typeof service.findAll>[0]['status'],
      });

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'confirmed' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return booking when found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(makeBooking());

      const result = await service.findOne(bookingId);

      expect(result.id).toBe(bookingId);
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findMyBookings', () => {
    it('should return bookings for patient', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([makeBooking()]);
      mockPrisma.booking.count.mockResolvedValue(1);

      const result = await service.findMyBookings(patientId);

      expect(result.items).toHaveLength(1);
      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ patientId }),
        }),
      );
    });
  });

  describe('findTodayBookingsForUser', () => {
    it('should throw ForbiddenException when user is not a practitioner', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.findTodayBookingsForUser(userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return today bookings for practitioner user', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue({
        id: practitionerId,
      });
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.booking.count.mockResolvedValue(0);

      const result = await service.findTodayBookingsForUser(userId);

      expect(result.items).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return zeroed stats when no bookings', async () => {
      mockPrisma.booking.groupBy.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.total).toBe(0);
      expect(result.confirmed).toBe(0);
      expect(result.pending).toBe(0);
    });

    it('should aggregate booking counts by status', async () => {
      mockPrisma.booking.groupBy.mockResolvedValue([
        { status: 'confirmed', _count: { _all: 5 } },
        { status: 'pending', _count: { _all: 3 } },
        { status: 'cancelled', _count: { _all: 1 } },
      ]);

      const result = await service.getStats();

      expect(result.total).toBe(9);
      expect(result.confirmed).toBe(5);
      expect(result.pending).toBe(3);
      expect(result.cancelled).toBe(1);
    });
  });

  describe('getNextAvailableSlots', () => {
    it('should return empty array when no availability configured', async () => {
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getNextAvailableSlots(
        practitionerId,
        new Date(),
        3,
      );

      expect(result).toEqual([]);
    });

    it('should return slots from available windows', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      mockPrisma.practitionerAvailability.findMany.mockResolvedValue([
        {
          practitionerId,
          dayOfWeek: tomorrow.getDay(),
          startTime: '09:00',
          endTime: '12:00',
          isActive: true,
        },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getNextAvailableSlots(
        practitionerId,
        new Date(),
        3,
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('startTime');
      expect(result[0]).toHaveProperty('endTime');
    });
  });
});
