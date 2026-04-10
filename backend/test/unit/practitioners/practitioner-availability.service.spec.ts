/**
 * PractitionerAvailabilityService — Holiday Exclusion Tests
 * Covers: getSlots + getAvailableDates must exclude clinic holidays
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PractitionerAvailabilityService } from '../../../src/modules/practitioners/practitioner-availability.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { ClinicSettingsService } from '../../../src/modules/clinic-settings/clinic-settings.service.js';
import { ClinicHolidaysService } from '../../../src/modules/clinic/clinic-holidays.service.js';

const mockPrisma: any = {
  practitioner: { findFirst: jest.fn() },
  practitionerAvailability: { findMany: jest.fn() },
  practitionerVacation: { findFirst: jest.fn(), findMany: jest.fn() },
  practitionerBreak: { findMany: jest.fn() },
  booking: { findMany: jest.fn() },
  practitionerService: { findUnique: jest.fn(), findMany: jest.fn() },
};

const mockBookingSettingsService = {
  getForBranch: jest.fn().mockResolvedValue({ bufferMinutes: 0 }),
};

const mockClinicSettingsService = {
  getTimezone: jest.fn().mockResolvedValue('Asia/Riyadh'),
};

const mockClinicHolidaysService = {
  isHoliday: jest.fn(),
  findAll: jest.fn(),
};

describe('PractitionerAvailabilityService — holiday exclusion', () => {
  let service: PractitionerAvailabilityService;
  let clinicHolidaysService: typeof mockClinicHolidaysService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionerAvailabilityService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingSettingsService, useValue: mockBookingSettingsService },
        { provide: ClinicSettingsService, useValue: mockClinicSettingsService },
        { provide: ClinicHolidaysService, useValue: mockClinicHolidaysService },
      ],
    }).compile();
    service = module.get<PractitionerAvailabilityService>(PractitionerAvailabilityService);
    clinicHolidaysService = mockClinicHolidaysService;
  });

  describe('getSlots — holiday exclusion', () => {
    it('should return empty slots for a holiday date', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue({
        id: 'p-1',
        isAcceptingBookings: true,
        deletedAt: null,
      });
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue([
        { practitionerId: 'p-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true, branchId: null },
      ]);
      mockPrisma.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrisma.practitionerBreak.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.practitionerService.findMany.mockResolvedValue([]);
      clinicHolidaysService.isHoliday.mockResolvedValue(true);

      const result = await service.getSlots('p-1', '2026-04-13', 30);

      expect(result.slots).toHaveLength(0);
    });

    it('should return slots when date is not a holiday', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue({
        id: 'p-1',
        isAcceptingBookings: true,
        deletedAt: null,
      });
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue([
        { practitionerId: 'p-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true, branchId: null },
      ]);
      mockPrisma.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrisma.practitionerBreak.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.practitionerService.findMany.mockResolvedValue([]);
      clinicHolidaysService.isHoliday.mockResolvedValue(false);

      const result = await service.getSlots('p-1', '2026-04-13', 30);

      expect(result.slots.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableDates — holiday exclusion', () => {
    it('should exclude a day that is a clinic holiday', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue({
        id: 'p-1',
        isAcceptingBookings: true,
        deletedAt: null,
      });
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue([
        { practitionerId: 'p-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true, branchId: null },
      ]);
      mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrisma.practitionerBreak.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.practitionerService.findMany.mockResolvedValue([]);
      mockBookingSettingsService.getForBranch.mockResolvedValue({ bufferMinutes: 0 });
      mockClinicSettingsService.getTimezone.mockResolvedValue('Asia/Riyadh');

      // findAll is called once before the loop; return a holiday on 2026-04-13
      clinicHolidaysService.findAll.mockResolvedValue([
        { date: new Date('2026-04-13'), isRecurring: false },
      ]);

      const result = await service.getAvailableDates('p-1', '2026-04');

      expect(result.availableDates).not.toContain('2026-04-13');
    });

    it('should include days that are not holidays', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue({
        id: 'p-1',
        isAcceptingBookings: true,
        deletedAt: null,
      });
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue([
        { practitionerId: 'p-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true, branchId: null },
      ]);
      mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrisma.practitionerBreak.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.practitionerService.findMany.mockResolvedValue([]);
      mockBookingSettingsService.getForBranch.mockResolvedValue({ bufferMinutes: 0 });
      mockClinicSettingsService.getTimezone.mockResolvedValue('Asia/Riyadh');
      clinicHolidaysService.findAll.mockResolvedValue([]);

      const result = await service.getAvailableDates('p-1', '2026-04');

      expect(result.availableDates).toContain('2026-04-13');
    });
  });
});
