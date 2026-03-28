/** CareKit — ClinicHoursService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClinicHoursService } from '../../../src/modules/clinic/clinic-hours.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';

const mockPrisma = {
  clinicWorkingHours: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const sampleHours = [
  {
    id: 'wh-1',
    dayOfWeek: 0,
    startTime: '09:00',
    endTime: '17:00',
    isActive: true,
  },
  {
    id: 'wh-2',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    isActive: true,
  },
];

describe('ClinicHoursService', () => {
  let service: ClinicHoursService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicHoursService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();
    service = module.get<ClinicHoursService>(ClinicHoursService);
  });

  // ─────────────────────────────────────────────
  //  getAll
  // ─────────────────────────────────────────────

  describe('getAll', () => {
    it('should return cached value without hitting DB when cache has data', async () => {
      mockCache.get.mockResolvedValue(sampleHours);

      const result = await service.getAll();

      expect(result).toBe(sampleHours);
      expect(mockPrisma.clinicWorkingHours.findMany).not.toHaveBeenCalled();
    });

    it('should query DB and cache result when cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.clinicWorkingHours.findMany.mockResolvedValue(sampleHours);

      const result = await service.getAll();

      expect(mockPrisma.clinicWorkingHours.findMany).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        'clinic:working-hours',
        sampleHours,
        300,
      );
      expect(result).toEqual(sampleHours);
    });
  });

  // ─────────────────────────────────────────────
  //  setHours
  // ─────────────────────────────────────────────

  describe('setHours', () => {
    it('should delete all hours and create new ones atomically when dto is valid', async () => {
      mockPrisma.clinicWorkingHours.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.clinicWorkingHours.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.$transaction.mockResolvedValue([{ count: 2 }, { count: 1 }]);
      mockPrisma.clinicWorkingHours.findMany.mockResolvedValue(sampleHours);

      const dto = {
        hours: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
        ],
      };
      await service.setHours(dto as never);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should invalidate cache after update when setHours succeeds', async () => {
      mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 1 }]);
      mockPrisma.clinicWorkingHours.findMany.mockResolvedValue(sampleHours);

      const dto = {
        hours: [
          { dayOfWeek: 1, startTime: '08:00', endTime: '16:00', isActive: true },
        ],
      };
      await service.setHours(dto as never);

      expect(mockCache.del).toHaveBeenCalledWith('clinic:working-hours');
    });

    it('should throw BadRequestException when startTime >= endTime', async () => {
      const dto = {
        hours: [
          { dayOfWeek: 1, startTime: '17:00', endTime: '09:00', isActive: true },
        ],
      };

      await expect(service.setHours(dto as never)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  //  getForDay
  // ─────────────────────────────────────────────

  describe('getForDay', () => {
    it('should return hours for a specific day when record exists', async () => {
      mockPrisma.clinicWorkingHours.findFirst.mockResolvedValue(sampleHours[1]);

      const result = await service.getForDay(1);

      expect(mockPrisma.clinicWorkingHours.findFirst).toHaveBeenCalledWith({
        where: { dayOfWeek: 1 },
      });
      expect(result).toEqual(sampleHours[1]);
    });
  });

  // ─────────────────────────────────────────────
  //  isClinicOpen
  // ─────────────────────────────────────────────

  describe('isClinicOpen', () => {
    it('should return true when time window fits within active hours', () => {
      const hours = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
      ] as never[];

      expect(service.isClinicOpen(hours, 1, '10:00', '11:00')).toBe(true);
    });

    it('should return false when day has no active hours', () => {
      const hours = [
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
      ] as never[];

      expect(service.isClinicOpen(hours, 1, '10:00', '11:00')).toBe(false);
    });

    it('should return false when time window exceeds clinic hours', () => {
      const hours = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
      ] as never[];

      // endTime 18:00 exceeds clinic endTime 17:00
      expect(service.isClinicOpen(hours, 1, '10:00', '18:00')).toBe(false);
    });

    it('should return false when slot is inactive', () => {
      const hours = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: false },
      ] as never[];

      expect(service.isClinicOpen(hours, 1, '10:00', '11:00')).toBe(false);
    });
  });
});
