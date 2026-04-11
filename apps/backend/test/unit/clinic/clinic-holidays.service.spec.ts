/** CareKit — ClinicHolidaysService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClinicHolidaysService } from '../../../src/modules/clinic/clinic-holidays.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';

const mockPrisma = {
  clinicHoliday: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
};

const eidHoliday = {
  id: 'holiday-1',
  nameAr: 'عيد الأضحى',
  nameEn: 'Eid Al-Adha',
  date: new Date(Date.UTC(2026, 5, 26)), // Jun 26 2026
  isRecurring: false,
  createdAt: new Date('2026-01-01'),
};

const recurringHoliday = {
  id: 'holiday-2',
  nameAr: 'اليوم الوطني',
  nameEn: 'National Day',
  date: new Date(Date.UTC(2025, 8, 23)), // Sep 23 (recurring)
  isRecurring: true,
  createdAt: new Date('2025-01-01'),
};

describe('ClinicHolidaysService', () => {
  let service: ClinicHolidaysService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicHolidaysService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();
    service = module.get<ClinicHolidaysService>(ClinicHolidaysService);
  });

  // ─────────────────────────────────────────────
  //  findAll
  // ─────────────────────────────────────────────

  describe('findAll', () => {
    it('should return cached holidays without hitting DB when cache has data', async () => {
      mockCache.get.mockResolvedValue([eidHoliday]);

      const result = await service.findAll();

      expect(result).toEqual([eidHoliday]);
      expect(mockPrisma.clinicHoliday.findMany).not.toHaveBeenCalled();
    });

    it('should filter by year when year is provided', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.clinicHoliday.findMany.mockResolvedValue([eidHoliday]);

      await service.findAll(2026);

      expect(mockPrisma.clinicHoliday.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date: {
              gte: new Date(Date.UTC(2026, 0, 1)),
              lt: new Date(Date.UTC(2027, 0, 1)),
            },
          },
        }),
      );
    });

    it('should use "all" cache key when no year is provided', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.clinicHoliday.findMany.mockResolvedValue([eidHoliday]);

      await service.findAll();

      expect(mockCache.get).toHaveBeenCalledWith('clinic:holidays:all');
      expect(mockCache.set).toHaveBeenCalledWith(
        'clinic:holidays:all',
        expect.anything(),
        300,
      );
    });
  });

  // ─────────────────────────────────────────────
  //  create
  // ─────────────────────────────────────────────

  describe('create', () => {
    it('should create holiday and invalidate cache', async () => {
      mockPrisma.clinicHoliday.create.mockResolvedValue(eidHoliday);

      const dto = {
        date: '2026-06-26',
        nameAr: 'عيد الأضحى',
        nameEn: 'Eid Al-Adha',
        isRecurring: false,
      };
      const result = await service.create(dto as never);

      expect(mockPrisma.clinicHoliday.create).toHaveBeenCalled();
      expect(mockCache.delPattern).toHaveBeenCalledWith('clinic:holidays:*');
      expect(result).toEqual(eidHoliday);
    });
  });

  // ─────────────────────────────────────────────
  //  delete
  // ─────────────────────────────────────────────

  describe('delete', () => {
    it('should delete holiday and invalidate cache when holiday exists', async () => {
      mockPrisma.clinicHoliday.findUnique.mockResolvedValue(eidHoliday);
      mockPrisma.clinicHoliday.delete.mockResolvedValue(eidHoliday);

      await service.delete('holiday-1');

      expect(mockPrisma.clinicHoliday.delete).toHaveBeenCalledWith({
        where: { id: 'holiday-1' },
      });
      expect(mockCache.delPattern).toHaveBeenCalledWith('clinic:holidays:*');
    });

    it('should throw NotFoundException when holiday not found', async () => {
      mockPrisma.clinicHoliday.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.clinicHoliday.delete).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  //  isHoliday
  // ─────────────────────────────────────────────

  describe('isHoliday', () => {
    it('should return true for exact date match', async () => {
      mockCache.get.mockResolvedValue([eidHoliday]);

      const result = await service.isHoliday(new Date(Date.UTC(2026, 5, 26)));

      expect(result).toBe(true);
    });

    it('should return false when date does not match any holiday', async () => {
      mockCache.get.mockResolvedValue([eidHoliday]);

      const result = await service.isHoliday(new Date(Date.UTC(2026, 5, 27)));

      expect(result).toBe(false);
    });

    it('should return true for recurring holiday on same month/day in different year', async () => {
      mockCache.get.mockResolvedValue([recurringHoliday]);

      // National Day Sep 23 — check in 2026 while stored as 2025
      const result = await service.isHoliday(new Date(Date.UTC(2026, 8, 23)));

      expect(result).toBe(true);
    });

    it('should return false for recurring holiday on different month/day', async () => {
      mockCache.get.mockResolvedValue([recurringHoliday]);

      // Same year but different month/day
      const result = await service.isHoliday(new Date(Date.UTC(2026, 8, 24)));

      expect(result).toBe(false);
    });
  });
});
