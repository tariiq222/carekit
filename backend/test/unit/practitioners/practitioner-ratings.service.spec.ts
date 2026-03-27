/**
 * PractitionerRatingsService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PractitionerRatingsService } from '../../../src/modules/practitioners/practitioner-ratings.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const practitionerId = 'pract-uuid-1';
const mockPractitioner = { id: practitionerId, deletedAt: null };

const mockRatings = [
  {
    id: 'r-1',
    practitionerId,
    score: 5,
    comment: 'Excellent',
    createdAt: new Date('2026-01-01'),
    patient: { firstName: 'Ahmad', lastName: 'Hassan' },
  },
  {
    id: 'r-2',
    practitionerId,
    score: 4,
    comment: 'Good',
    createdAt: new Date('2026-01-02'),
    patient: { firstName: 'Sara', lastName: 'Ali' },
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  practitioner: { findUnique: jest.fn() },
  rating: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('PractitionerRatingsService', () => {
  let service: PractitionerRatingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionerRatingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PractitionerRatingsService>(PractitionerRatingsService);
    jest.clearAllMocks();
  });

  describe('getRatings', () => {
    it('should return paginated ratings with anonymized patient names', async () => {
      mockPrisma.practitioner.findUnique.mockResolvedValue(mockPractitioner);
      mockPrisma.rating.findMany.mockResolvedValue(mockRatings);
      mockPrisma.rating.count.mockResolvedValue(2);

      const result = await service.getRatings(practitionerId);

      expect(result.items).toHaveLength(2);
      expect(result.meta).toBeDefined();
      expect(result.meta.total).toBe(2);
    });

    it('should anonymize patient last names to initial + dot', async () => {
      mockPrisma.practitioner.findUnique.mockResolvedValue(mockPractitioner);
      mockPrisma.rating.findMany.mockResolvedValue([mockRatings[0]]);
      mockPrisma.rating.count.mockResolvedValue(1);

      const result = await service.getRatings(practitionerId);

      expect(result.items[0].patient?.lastName).toBe('H.');
      expect(result.items[0].patient?.firstName).toBe('Ahmad');
    });

    it('should handle ratings with null patient', async () => {
      const ratingWithNullPatient = { ...mockRatings[0], patient: null };
      mockPrisma.practitioner.findUnique.mockResolvedValue(mockPractitioner);
      mockPrisma.rating.findMany.mockResolvedValue([ratingWithNullPatient]);
      mockPrisma.rating.count.mockResolvedValue(1);

      const result = await service.getRatings(practitionerId);

      expect(result.items[0].patient).toBeNull();
    });

    it('should throw NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findUnique.mockResolvedValue(null);

      await expect(service.getRatings('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when practitioner is soft-deleted', async () => {
      mockPrisma.practitioner.findUnique.mockResolvedValue({
        ...mockPractitioner,
        deletedAt: new Date(),
      });

      await expect(service.getRatings(practitionerId)).rejects.toThrow(NotFoundException);
    });

    it('should pass pagination params to findMany', async () => {
      mockPrisma.practitioner.findUnique.mockResolvedValue(mockPractitioner);
      mockPrisma.rating.findMany.mockResolvedValue([]);
      mockPrisma.rating.count.mockResolvedValue(0);

      await service.getRatings(practitionerId, { page: 2, perPage: 10 });

      expect(mockPrisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should return empty items when no ratings exist', async () => {
      mockPrisma.practitioner.findUnique.mockResolvedValue(mockPractitioner);
      mockPrisma.rating.findMany.mockResolvedValue([]);
      mockPrisma.rating.count.mockResolvedValue(0);

      const result = await service.getRatings(practitionerId);

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });
});
