/**
 * FavoritePractitionersService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FavoritePractitionersService } from '../../../src/modules/practitioners/favorite-practitioners.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const patientId = 'patient-uuid-1';
const practitionerId = 'pract-uuid-1';

const mockPractitioner = {
  id: practitionerId,
  isActive: true,
  deletedAt: null,
};

const mockFavorite = {
  id: 'fav-uuid-1',
  patientId,
  practitionerId,
  createdAt: new Date('2026-01-01'),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  practitioner: {
    findFirst: jest.fn(),
  },
  favoritePractitioner: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('FavoritePractitionersService', () => {
  let service: FavoritePractitionersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritePractitionersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FavoritePractitionersService>(FavoritePractitionersService);
    jest.clearAllMocks();
  });

  describe('addFavorite', () => {
    it('should create and return a new favorite', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.favoritePractitioner.findUnique.mockResolvedValue(null);
      mockPrisma.favoritePractitioner.create.mockResolvedValue(mockFavorite);

      const result = await service.addFavorite(patientId, practitionerId);

      expect(result).toEqual(mockFavorite);
      expect(mockPrisma.favoritePractitioner.create).toHaveBeenCalledWith({
        data: { patientId, practitionerId },
      });
    });

    it('should return existing favorite without creating duplicate', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.favoritePractitioner.findUnique.mockResolvedValue(mockFavorite);

      const result = await service.addFavorite(patientId, practitionerId);

      expect(result).toEqual(mockFavorite);
      expect(mockPrisma.favoritePractitioner.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.addFavorite(patientId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.favoritePractitioner.create).not.toHaveBeenCalled();
    });

    it('should query practitioner with isActive and deletedAt filter', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.favoritePractitioner.findUnique.mockResolvedValue(null);
      mockPrisma.favoritePractitioner.create.mockResolvedValue(mockFavorite);

      await service.addFavorite(patientId, practitionerId);

      expect(mockPrisma.practitioner.findFirst).toHaveBeenCalledWith({
        where: { id: practitionerId, isActive: true, deletedAt: null },
      });
    });
  });

  describe('removeFavorite', () => {
    it('should delete and return success', async () => {
      mockPrisma.favoritePractitioner.findUnique.mockResolvedValue(mockFavorite);
      mockPrisma.favoritePractitioner.delete.mockResolvedValue(mockFavorite);

      const result = await service.removeFavorite(patientId, practitionerId);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.favoritePractitioner.delete).toHaveBeenCalledWith({
        where: { id: mockFavorite.id },
      });
    });

    it('should throw NotFoundException if favorite not found', async () => {
      mockPrisma.favoritePractitioner.findUnique.mockResolvedValue(null);

      await expect(
        service.removeFavorite(patientId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.favoritePractitioner.delete).not.toHaveBeenCalled();
    });
  });

  describe('getFavorites', () => {
    it('should return all favorites for a patient', async () => {
      const favorites = [
        { ...mockFavorite, practitioner: { ...mockPractitioner, user: { id: 'u1', firstName: 'Ali', lastName: 'Hassan', avatarUrl: null } } },
      ];
      mockPrisma.favoritePractitioner.findMany.mockResolvedValue(favorites);

      const result = await service.getFavorites(patientId);

      expect(result).toHaveLength(1);
      expect(mockPrisma.favoritePractitioner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should return empty array when patient has no favorites', async () => {
      mockPrisma.favoritePractitioner.findMany.mockResolvedValue([]);
      const result = await service.getFavorites(patientId);
      expect(result).toEqual([]);
    });
  });
});
