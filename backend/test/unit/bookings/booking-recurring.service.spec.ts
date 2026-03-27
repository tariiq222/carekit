/**
 * BookingRecurringService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BookingRecurringService } from '../../../src/modules/bookings/booking-recurring.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { BookingsService } from '../../../src/modules/bookings/bookings.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';

const patientId = 'patient-uuid-1';

const defaultSettings = {
  allowRecurring: true,
  allowedRecurringPatterns: ['weekly', 'biweekly'],
  maxRecurrences: 12,
  bufferMinutes: 0,
  minBookingLeadMinutes: 0,
};

const recurringDto = {
  practitionerId: 'pract-uuid',
  serviceId: 'svc-uuid',
  branchId: 'branch-uuid',
  type: 'clinic_visit' as const,
  date: '2026-04-01',
  startTime: '09:00',
  repeatEvery: 'weekly',
  repeatCount: 3,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockBookingsService: any = {
  create: jest.fn().mockResolvedValue({ id: 'booking-uuid' }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSettingsService: any = {
  getForBranch: jest.fn().mockResolvedValue(defaultSettings),
};

describe('BookingRecurringService', () => {
  let service: BookingRecurringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingRecurringService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingsService, useValue: mockBookingsService },
        { provide: BookingSettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    service = module.get<BookingRecurringService>(BookingRecurringService);
    jest.clearAllMocks();
    mockSettingsService.getForBranch.mockResolvedValue(defaultSettings);
  });

  describe('createRecurring', () => {
    it('should create recurring bookings and return summary', async () => {
      mockBookingsService.create.mockResolvedValue({ id: 'booking-uuid' });

      const result = await service.createRecurring(patientId, recurringDto);

      expect(result.totalRequested).toBe(3);
      expect(result.totalCreated).toBe(3);
      expect(result.created).toHaveLength(3);
      expect(result.conflicts).toHaveLength(0);
      expect(result.recurringGroupId).toBeDefined();
      expect(result.pattern).toBe('weekly');
    });

    it('should throw BadRequestException when recurring not allowed', async () => {
      mockSettingsService.getForBranch.mockResolvedValue({
        ...defaultSettings,
        allowRecurring: false,
      });

      await expect(
        service.createRecurring(patientId, recurringDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when pattern not allowed', async () => {
      mockSettingsService.getForBranch.mockResolvedValue({
        ...defaultSettings,
        allowedRecurringPatterns: ['daily'],
      });

      await expect(
        service.createRecurring(patientId, { ...recurringDto, repeatEvery: 'weekly' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when repeatCount exceeds max', async () => {
      mockSettingsService.getForBranch.mockResolvedValue({
        ...defaultSettings,
        maxRecurrences: 2,
      });

      await expect(
        service.createRecurring(patientId, { ...recurringDto, repeatCount: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should record conflicts when bookings fail', async () => {
      mockBookingsService.create
        .mockResolvedValueOnce({ id: 'b-1' })
        .mockRejectedValueOnce(new Error('Slot not available'))
        .mockResolvedValueOnce({ id: 'b-3' });

      const result = await service.createRecurring(patientId, recurringDto);

      expect(result.totalCreated).toBe(2);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toBe('Slot not available');
    });

    it('should use default allowed patterns when DB value is empty', async () => {
      mockSettingsService.getForBranch.mockResolvedValue({
        ...defaultSettings,
        allowedRecurringPatterns: [],
      });
      mockBookingsService.create.mockResolvedValue({ id: 'b-1' });

      // 'weekly' is a default allowed pattern
      const result = await service.createRecurring(patientId, {
        ...recurringDto,
        repeatEvery: 'weekly',
        repeatCount: 1,
      });

      expect(result.totalCreated).toBe(1);
    });

    it('should space bookings by 7 days for weekly pattern', async () => {
      mockBookingsService.create.mockResolvedValue({ id: 'b-1' });
      const dateCalls: string[] = [];
      mockBookingsService.create.mockImplementation(
        (_pid: string, dto: { date: string }) => {
          dateCalls.push(dto.date);
          return Promise.resolve({ id: 'b-x' });
        },
      );

      await service.createRecurring(patientId, {
        ...recurringDto,
        date: '2026-04-01',
        repeatEvery: 'weekly',
        repeatCount: 3,
      });

      expect(dateCalls[0]).toBe('2026-04-01');
      expect(dateCalls[1]).toBe('2026-04-08');
      expect(dateCalls[2]).toBe('2026-04-15');
    });

    it('should use maxRecurrences of 12 when not set in settings', async () => {
      mockSettingsService.getForBranch.mockResolvedValue({
        ...defaultSettings,
        maxRecurrences: null,
      });

      // repeatCount 13 > default max 12
      await expect(
        service.createRecurring(patientId, { ...recurringDto, repeatCount: 13 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
