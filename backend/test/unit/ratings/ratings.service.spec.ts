/** CareKit — RatingsService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RatingsService } from '../../../src/modules/ratings/ratings.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const mockBooking = {
  id: 'booking-1',
  status: 'completed',
  patientId: 'patient-1',
  practitionerId: 'practitioner-1',
  rating: null,
};

const mockRating = {
  id: 'rating-1',
  bookingId: 'booking-1',
  practitionerId: 'practitioner-1',
  patientId: 'patient-1',
  stars: 5,
  comment: 'ممتاز',
  createdAt: new Date('2026-03-01'),
};

const mockPrismaService: any = {
  booking: { findFirst: jest.fn() },
  rating: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    aggregate: jest.fn(),
  },
  practitioner: { update: jest.fn() },
  $transaction: jest.fn(),
};

async function runInTransaction<T>(fn: (tx: typeof mockPrismaService) => Promise<T>): Promise<T> {
  return fn(mockPrismaService);
}

describe('RatingsService', () => {
  let service: RatingsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();
    service = module.get<RatingsService>(RatingsService);
  });

  describe('create', () => {
    beforeEach(async () => {
      mockPrismaService.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrismaService) => Promise<unknown>) => fn(mockPrismaService),
      );
    });

    it('throws NotFoundException when booking not found', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ bookingId: 'nonexistent', patientId: 'patient-1', stars: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when booking status is not completed', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        status: 'confirmed',
      });

      await expect(
        service.create({ bookingId: 'booking-1', patientId: 'patient-1', stars: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when booking already has a rating', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        rating: { id: 'existing-rating' },
      });

      await expect(
        service.create({ bookingId: 'booking-1', patientId: 'patient-1', stars: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when stars < 1', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);

      await expect(
        service.create({ bookingId: 'booking-1', patientId: 'patient-1', stars: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when stars > 5', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);

      await expect(
        service.create({ bookingId: 'booking-1', patientId: 'patient-1', stars: 6 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates rating with correct practitionerId from booking', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.rating.create.mockResolvedValue(mockRating);
      mockPrismaService.rating.aggregate.mockResolvedValue({
        _avg: { stars: 5 },
        _count: { id: 1 },
      });

      await service.create({ bookingId: 'booking-1', patientId: 'patient-1', stars: 5 });

      expect(mockPrismaService.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            practitionerId: 'practitioner-1',
          }),
        }),
      );
    });

    it('should call updatePractitionerRating inside the same transaction', async () => {
      const booking = {
        id: 'booking-1',
        status: 'completed',
        practitionerId: 'practitioner-1',
        rating: null,
      };

      mockPrismaService.booking.findFirst.mockResolvedValue(booking);

      let transactionWasCalled = false;
      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
        transactionWasCalled = true;
        const tx = {
          rating: {
            create: jest.fn().mockResolvedValue({ id: 'rating-1', stars: 5 }),
            aggregate: jest.fn().mockResolvedValue({ _avg: { stars: 4.5 }, _count: { id: 2 } }),
          },
          practitioner: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      await service.create({
        bookingId: 'booking-1',
        patientId: 'patient-1',
        stars: 5,
      });

      expect(transactionWasCalled).toBe(true);
    });

    it('calls updatePractitionerRating after creating rating', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.rating.create.mockResolvedValue(mockRating);
      mockPrismaService.rating.aggregate.mockResolvedValue({
        _avg: { stars: 4.5 },
        _count: { id: 2 },
      });

      await service.create({ bookingId: 'booking-1', patientId: 'patient-1', stars: 5 });

      expect(mockPrismaService.rating.aggregate).toHaveBeenCalled();
      expect(mockPrismaService.practitioner.update).toHaveBeenCalled();
    });

    it('returns created rating', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.rating.create.mockResolvedValue(mockRating);
      mockPrismaService.rating.aggregate.mockResolvedValue({
        _avg: { stars: 5 },
        _count: { id: 1 },
      });

      const result = await service.create({ bookingId: 'booking-1', patientId: 'patient-1', stars: 5 });

      expect(result).toEqual(mockRating);
    });
  });

  describe('findByPractitioner', () => {
    it('returns paginated ratings with correct meta', async () => {
      mockPrismaService.rating.count.mockResolvedValue(25);
      mockPrismaService.rating.findMany.mockResolvedValue([mockRating]);

      const result = await service.findByPractitioner('practitioner-1', {
        page: 1,
        perPage: 10,
      });

      expect(result.items).toEqual([mockRating]);
      expect(result.meta.total).toBe(25);
      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(10);
    });

    it('applies skip correctly for page=2, perPage=10 → skip=10', async () => {
      mockPrismaService.rating.count.mockResolvedValue(30);
      mockPrismaService.rating.findMany.mockResolvedValue([]);

      await service.findByPractitioner('practitioner-1', {
        page: 2,
        perPage: 10,
      });

      expect(mockPrismaService.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('returns totalPages=Math.ceil(total/perPage)', async () => {
      mockPrismaService.rating.count.mockResolvedValue(25);
      mockPrismaService.rating.findMany.mockResolvedValue([]);

      const result = await service.findByPractitioner('practitioner-1', {
        page: 1,
        perPage: 10,
      });

      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('findByBooking', () => {
    it('returns rating when found', async () => {
      mockPrismaService.rating.findUnique.mockResolvedValue(mockRating);

      const result = await service.findByBooking('booking-1');

      expect(result).toEqual(mockRating);
    });

    it('returns null when rating not found', async () => {
      mockPrismaService.rating.findUnique.mockResolvedValue(null);

      const result = await service.findByBooking('nonexistent-booking');

      expect(result).toBeNull();
    });
  });

  describe('updatePractitionerRating', () => {
    it('updates practitioner with correct avg stars and count', async () => {
      mockPrismaService.rating.aggregate.mockResolvedValue({
        _avg: { stars: 4.2 },
        _count: { id: 10 },
      });

      await service.updatePractitionerRating('practitioner-1');

      expect(mockPrismaService.practitioner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'practitioner-1' },
          data: expect.objectContaining({ rating: 4.2, reviewCount: 10 }),
        }),
      );
    });

    it('uses 0 when _avg.stars is null', async () => {
      mockPrismaService.rating.aggregate.mockResolvedValue({
        _avg: { stars: null },
        _count: { id: 0 },
      });

      await service.updatePractitionerRating('practitioner-1');

      expect(mockPrismaService.practitioner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rating: 0 }),
        }),
      );
    });
  });
});
