/**
 * BookingSettingsService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';

const mockSettings = {
  id: 'settings-uuid-1',
  branchId: null,
  bufferMinutes: 10,
  minBookingLeadMinutes: 60,
  maxBookingLeadDays: 30,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  bookingSettings: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCache: any = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

describe('BookingSettingsService', () => {
  let service: BookingSettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingSettingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<BookingSettingsService>(BookingSettingsService);
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
  });

  describe('get', () => {
    it('should return cached settings without hitting DB', async () => {
      mockCache.get.mockResolvedValue(mockSettings);

      const result = await service.get();

      expect(result).toEqual(mockSettings);
      expect(mockPrisma.bookingSettings.findFirst).not.toHaveBeenCalled();
    });

    it('should return settings from DB and cache them', async () => {
      mockPrisma.bookingSettings.findFirst.mockResolvedValue(mockSettings);

      const result = await service.get();

      expect(result).toEqual(mockSettings);
      expect(mockCache.set).toHaveBeenCalledWith(
        'booking:settings:global',
        mockSettings,
        3600,
      );
    });

    it('should create default settings when none exist', async () => {
      mockPrisma.bookingSettings.findFirst.mockResolvedValue(null);
      mockPrisma.bookingSettings.create.mockResolvedValue(mockSettings);

      const result = await service.get();

      expect(result).toEqual(mockSettings);
      expect(mockPrisma.bookingSettings.create).toHaveBeenCalledWith({ data: {} });
    });
  });

  describe('getForBranch', () => {
    it('should fall back to global when branchId is undefined', async () => {
      mockPrisma.bookingSettings.findFirst.mockResolvedValue(mockSettings);

      const result = await service.getForBranch(undefined);

      expect(result).toEqual(mockSettings);
      expect(mockPrisma.bookingSettings.findFirst).toHaveBeenCalledWith({
        where: { branchId: null },
      });
    });

    it('should return cached branch settings without hitting DB', async () => {
      mockCache.get.mockResolvedValue(mockSettings);

      const result = await service.getForBranch('branch-1');

      expect(result).toEqual(mockSettings);
      expect(mockPrisma.bookingSettings.findFirst).not.toHaveBeenCalled();
    });

    it('should return branch-specific settings when found', async () => {
      const branchSettings = { ...mockSettings, id: 'bs-2', branchId: 'branch-1' };
      mockPrisma.bookingSettings.findFirst.mockResolvedValue(branchSettings);

      const result = await service.getForBranch('branch-1');

      expect(result).toEqual(branchSettings);
      expect(mockCache.set).toHaveBeenCalledWith(
        'booking:settings:branch:branch-1',
        branchSettings,
        3600,
      );
    });

    it('should fall back to global settings when branch row not found', async () => {
      mockPrisma.bookingSettings.findFirst
        .mockResolvedValueOnce(null)          // branch lookup
        .mockResolvedValueOnce(mockSettings); // global fallback

      const result = await service.getForBranch('branch-new');

      expect(result).toEqual(mockSettings);
    });
  });

  describe('update', () => {
    it('should update existing settings', async () => {
      const updatedSettings = { ...mockSettings, bufferMinutes: 15 };
      mockPrisma.bookingSettings.findFirst.mockResolvedValue(mockSettings);
      mockPrisma.bookingSettings.update.mockResolvedValue(updatedSettings);

      const result = await service.update({ bufferMinutes: 15 });

      expect(result).toEqual(updatedSettings);
      expect(mockPrisma.bookingSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockSettings.id } }),
      );
      expect(mockCache.del).toHaveBeenCalledWith('booking:settings:global');
    });

    it('should create settings when none exist', async () => {
      mockPrisma.bookingSettings.findFirst.mockResolvedValue(null);
      mockPrisma.bookingSettings.create.mockResolvedValue(mockSettings);

      const result = await service.update({ bufferMinutes: 10 });

      expect(result).toEqual(mockSettings);
      expect(mockPrisma.bookingSettings.create).toHaveBeenCalled();
    });

    it('should invalidate branch cache when branchId provided', async () => {
      const branchSettings = { ...mockSettings, branchId: 'branch-1' };
      mockPrisma.bookingSettings.findFirst.mockResolvedValue(branchSettings);
      mockPrisma.bookingSettings.update.mockResolvedValue(branchSettings);

      await service.update({ branchId: 'branch-1', bufferMinutes: 5 } as Parameters<typeof service.update>[0]);

      expect(mockCache.del).toHaveBeenCalledWith('booking:settings:global');
      expect(mockCache.del).toHaveBeenCalledWith('booking:settings:branch:branch-1');
    });
  });
});
