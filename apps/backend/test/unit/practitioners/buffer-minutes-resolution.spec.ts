/**
 * Regression tests for CRITICAL fix #2:
 * bufferMinutes resolution — ?? operator broken with @default(0)
 *
 * Before fix: ps.bufferMinutes ?? service.bufferMinutes always short-circuits to 0
 *             because @default(0) in Prisma means the field is never null/undefined.
 * After fix:  ps.bufferMinutes > 0 is the correct override check.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PractitionerAvailabilityService } from '../../../src/modules/practitioners/practitioner-availability.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { ClinicSettingsService } from '../../../src/modules/clinic-settings/clinic-settings.service.js';
import { ClinicHolidaysService } from '../../../src/modules/clinic/clinic-holidays.service.js';

// ─── Minimal mocks ────────────────────────────────────────────────────────────

const mockPrisma = {
  practitioner: { findFirst: jest.fn() },
  practitionerAvailability: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  practitionerVacation: { findFirst: jest.fn(), findMany: jest.fn() },
  practitionerBreak: { findMany: jest.fn() },
  practitionerService: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  booking: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockBookingSettings = {
  getForBranch: jest.fn().mockResolvedValue({
    bufferMinutes: 0,
    minBookingLeadMinutes: 0,
    maxAdvanceBookingDays: 0,
    walkInPaymentRequired: false,
    allowWalkIn: true,
  }),
};

const mockClinicSettings = {
  getTimezone: jest.fn().mockResolvedValue('Asia/Riyadh'),
};

const mockClinicHolidays = {
  isHoliday: jest.fn().mockResolvedValue(false),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('PractitionerAvailabilityService — resolveBufferMinutes (CRITICAL #2)', () => {
  let service: PractitionerAvailabilityService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default practitioner exists and accepts bookings
    mockPrisma.practitioner.findFirst.mockResolvedValue({
      id: 'prac-1',
      isAcceptingBookings: true,
      deletedAt: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionerAvailabilityService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingSettingsService, useValue: mockBookingSettings },
        { provide: ClinicSettingsService, useValue: mockClinicSettings },
        { provide: ClinicHolidaysService, useValue: mockClinicHolidays },
      ],
    }).compile();

    service = module.get(PractitionerAvailabilityService);
  });

  // ── Core bug regression ──────────────────────────────────────────────────

  it('REGRESSION: uses service.bufferMinutes when ps.bufferMinutes is 0 (Prisma @default)', async () => {
    // This is the exact bug: ps.bufferMinutes=0 (Prisma default), service.bufferMinutes=15
    // Old code: 0 ?? 15 → 0 (wrong — ?? doesn't fire on 0)
    // New code: 0 > 0 ? 0 : 15 → 15 (correct)
    mockPrisma.practitionerService.findMany.mockResolvedValue([
      {
        bufferMinutes: 0, // Prisma @default(0) — not an explicit override
        service: { bufferMinutes: 15 },
      },
    ]);

    const result = await (
      service as unknown as {
        resolveBufferMinutes: (id: string, global: number) => Promise<number>;
      }
    ).resolveBufferMinutes('prac-1', 0);

    expect(result).toBe(15); // must be 15, not 0
  });

  it('uses ps.bufferMinutes when explicitly set > 0', async () => {
    mockPrisma.practitionerService.findMany.mockResolvedValue([
      {
        bufferMinutes: 10, // explicit practitioner override
        service: { bufferMinutes: 15 },
      },
    ]);

    const result = await (
      service as unknown as {
        resolveBufferMinutes: (id: string, global: number) => Promise<number>;
      }
    ).resolveBufferMinutes('prac-1', 0);

    expect(result).toBe(10); // practitioner override wins
  });

  it('returns globalBufferMinutes when it exceeds all service buffers', async () => {
    mockPrisma.practitionerService.findMany.mockResolvedValue([
      { bufferMinutes: 0, service: { bufferMinutes: 5 } },
    ]);

    const result = await (
      service as unknown as {
        resolveBufferMinutes: (id: string, global: number) => Promise<number>;
      }
    ).resolveBufferMinutes('prac-1', 20);

    expect(result).toBe(20); // global wins — most conservative
  });

  it('takes max across multiple services', async () => {
    mockPrisma.practitionerService.findMany.mockResolvedValue([
      { bufferMinutes: 0, service: { bufferMinutes: 10 } },
      { bufferMinutes: 25, service: { bufferMinutes: 5 } }, // explicit 25
      { bufferMinutes: 0, service: { bufferMinutes: 15 } },
    ]);

    const result = await (
      service as unknown as {
        resolveBufferMinutes: (id: string, global: number) => Promise<number>;
      }
    ).resolveBufferMinutes('prac-1', 0);

    expect(result).toBe(25); // max of [10, 25, 15] = 25
  });

  it('returns 0 when no practitioner services and no global buffer', async () => {
    mockPrisma.practitionerService.findMany.mockResolvedValue([]);

    const result = await (
      service as unknown as {
        resolveBufferMinutes: (id: string, global: number) => Promise<number>;
      }
    ).resolveBufferMinutes('prac-1', 0);

    expect(result).toBe(0);
  });
});
