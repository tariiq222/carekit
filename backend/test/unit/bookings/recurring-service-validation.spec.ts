/**
 * Regression tests for CRITICAL fix #4:
 * service.allowRecurring / allowedRecurringPatterns / maxRecurrences were dead fields.
 * booking-recurring.service.ts only checked clinic-level settings, ignoring service config.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingRecurringService } from '../../../src/modules/bookings/booking-recurring.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { BookingsService } from '../../../src/modules/bookings/bookings.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';

const BASE_DTO = {
  practitionerId: 'prac-uuid',
  serviceId: 'svc-uuid',
  branchId: 'branch-uuid',
  type: 'in_person' as const,
  date: '2026-05-01',
  startTime: '10:00',
  repeatEvery: 'weekly',
  repeatCount: 3,
};

const CLINIC_SETTINGS = {
  allowRecurring: true,
  allowedRecurringPatterns: ['weekly', 'biweekly', 'daily'],
  maxRecurrences: 12,
  bufferMinutes: 0,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  service: { findFirst: jest.fn() },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockBookingsService: any = {
  create: jest.fn().mockResolvedValue({ id: 'booking-uuid' }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSettingsService: any = {
  getForBranch: jest.fn().mockResolvedValue(CLINIC_SETTINGS),
};

describe('BookingRecurringService — service-level validation (CRITICAL #4)', () => {
  let service: BookingRecurringService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettingsService.getForBranch.mockResolvedValue(CLINIC_SETTINGS);
    mockBookingsService.create.mockResolvedValue({ id: 'booking-uuid' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingRecurringService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingsService, useValue: mockBookingsService },
        { provide: BookingSettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    service = module.get(BookingRecurringService);
  });

  // ── service not found ────────────────────────────────────────────────────

  it('throws NotFoundException when service does not exist', async () => {
    mockPrisma.service.findFirst.mockResolvedValue(null);

    await expect(service.createRecurring('user-1', BASE_DTO)).rejects.toThrow(NotFoundException);
  });

  // ── service.allowRecurring ───────────────────────────────────────────────

  it('REGRESSION: throws BadRequestException when service.allowRecurring=false', async () => {
    // Before fix: this was never checked — recurring bookings could be created
    // for services that explicitly disallow it.
    mockPrisma.service.findFirst.mockResolvedValue({
      allowRecurring: false,
      allowedRecurringPatterns: [],
      maxRecurrences: 12,
    });

    await expect(service.createRecurring('user-1', BASE_DTO)).rejects.toMatchObject({
      response: { error: 'SERVICE_RECURRING_NOT_ALLOWED' },
    });
  });

  it('proceeds when service.allowRecurring=true', async () => {
    mockPrisma.service.findFirst.mockResolvedValue({
      allowRecurring: true,
      allowedRecurringPatterns: [],
      maxRecurrences: 0,
    });

    const result = await service.createRecurring('user-1', BASE_DTO);
    expect(result.totalCreated).toBeGreaterThanOrEqual(0);
  });

  // ── service.allowedRecurringPatterns ─────────────────────────────────────

  it('REGRESSION: rejects pattern not in service.allowedRecurringPatterns', async () => {
    // Clinic allows [weekly, biweekly, daily] but service only allows [weekly]
    // Requesting 'daily' must be rejected
    mockPrisma.service.findFirst.mockResolvedValue({
      allowRecurring: true,
      allowedRecurringPatterns: ['weekly'],
      maxRecurrences: 0,
    });

    await expect(
      service.createRecurring('user-1', { ...BASE_DTO, repeatEvery: 'daily' }),
    ).rejects.toMatchObject({ response: { error: 'RECURRING_PATTERN_NOT_ALLOWED' } });
  });

  it('accepts pattern that is in both service and clinic patterns (intersection)', async () => {
    mockPrisma.service.findFirst.mockResolvedValue({
      allowRecurring: true,
      allowedRecurringPatterns: ['weekly', 'daily'],
      maxRecurrences: 0,
    });

    const result = await service.createRecurring('user-1', { ...BASE_DTO, repeatEvery: 'weekly' });
    expect(result.pattern).toBe('weekly');
  });

  it('uses clinic patterns when service.allowedRecurringPatterns is empty', async () => {
    mockPrisma.service.findFirst.mockResolvedValue({
      allowRecurring: true,
      allowedRecurringPatterns: [],
      maxRecurrences: 0,
    });

    // Clinic allows weekly — should work
    const result = await service.createRecurring('user-1', BASE_DTO);
    expect(result).toBeDefined();
  });

  // ── service.maxRecurrences ───────────────────────────────────────────────

  it('REGRESSION: rejects repeatCount exceeding service.maxRecurrences', async () => {
    // Service allows max 4, clinic allows 12 — stricter service limit must win
    mockPrisma.service.findFirst.mockResolvedValue({
      allowRecurring: true,
      allowedRecurringPatterns: [],
      maxRecurrences: 4,
    });

    await expect(
      service.createRecurring('user-1', { ...BASE_DTO, repeatCount: 8 }),
    ).rejects.toMatchObject({ response: { error: 'RECURRING_TOO_MANY' } });
  });

  it('uses clinic maxRecurrences when service.maxRecurrences is 0 (unlimited)', async () => {
    mockPrisma.service.findFirst.mockResolvedValue({
      allowRecurring: true,
      allowedRecurringPatterns: [],
      maxRecurrences: 0, // 0 = unlimited at service level → fall back to clinic
    });

    // repeatCount=13 > clinic max 12 → should be rejected by clinic limit
    await expect(
      service.createRecurring('user-1', { ...BASE_DTO, repeatCount: 13 }),
    ).rejects.toMatchObject({ response: { error: 'RECURRING_TOO_MANY' } });
  });

  it('takes the stricter of service and clinic maxRecurrences', async () => {
    // Service: 6, Clinic: 12 → effective max is 6
    mockPrisma.service.findFirst.mockResolvedValue({
      allowRecurring: true,
      allowedRecurringPatterns: [],
      maxRecurrences: 6,
    });

    await expect(
      service.createRecurring('user-1', { ...BASE_DTO, repeatCount: 7 }),
    ).rejects.toMatchObject({ response: { error: 'RECURRING_TOO_MANY' } });
  });
});
