/**
 * PractitionersService — Availability & Slots Tests
 * Covers: getAvailability, setAvailability, getAvailableSlots
 */
import { NotFoundException, BadRequestException } from '@nestjs/common';
import {
  createPractitionersTestModule,
  PractitionersTestContext,
} from './practitioners.test-module.js';
import {
  mockPractitioner,
  mockAvailability,
  mockVacation,
} from './practitioners.fixtures.js';

describe('PractitionersService — getAvailability', () => {
  let ctx: PractitionersTestContext;

  beforeEach(async () => {
    ctx = await createPractitionersTestModule();
    jest.clearAllMocks();
  });

  it('should return weekly availability schedule', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerAvailability.findMany.mockResolvedValue(
      mockAvailability,
    );

    const result = await ctx.availabilityService.getAvailability(
      mockPractitioner.id,
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('dayOfWeek');
    expect(result[0]).toHaveProperty('startTime');
    expect(result[0]).toHaveProperty('endTime');
  });

  it('should throw NotFoundException if practitioner not found', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(null);

    await expect(
      ctx.availabilityService.getAvailability('non-existent-id'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('PractitionersService — setAvailability', () => {
  let ctx: PractitionersTestContext;

  const scheduleDto = {
    schedule: [
      { dayOfWeek: 0, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 0, startTime: '14:00', endTime: '17:00' },
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
    ],
  };

  beforeEach(async () => {
    ctx = await createPractitionersTestModule();
    jest.clearAllMocks();
  });

  it('should replace existing availability with new schedule', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerAvailability.deleteMany.mockResolvedValue({
      count: 3,
    });
    ctx.mockPrisma.practitionerAvailability.createMany.mockResolvedValue({
      count: 3,
    });
    ctx.mockPrisma.practitionerAvailability.findMany.mockResolvedValue(
      mockAvailability,
    );

    const result = await ctx.availabilityService.setAvailability(
      mockPractitioner.id,
      scheduleDto,
    );

    expect(
      ctx.mockPrisma.practitionerAvailability.deleteMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { practitionerId: mockPractitioner.id },
      }),
    );
    expect(
      ctx.mockPrisma.practitionerAvailability.createMany,
    ).toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });

  it.each([
    [
      'invalid dayOfWeek (7)',
      [{ dayOfWeek: 7, startTime: '09:00', endTime: '12:00' }],
    ],
    [
      'invalid time format (9am)',
      [{ dayOfWeek: 1, startTime: '9am', endTime: '12pm' }],
    ],
    [
      'endTime before startTime',
      [{ dayOfWeek: 1, startTime: '14:00', endTime: '12:00' }],
    ],
    [
      'overlapping slots on same day',
      [
        { dayOfWeek: 1, startTime: '09:00', endTime: '14:00' },
        { dayOfWeek: 1, startTime: '13:00', endTime: '17:00' },
      ],
    ],
  ])('should reject %s', async (_label, schedule) => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

    await expect(
      ctx.availabilityService.setAvailability(mockPractitioner.id, {
        schedule,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if practitioner not found', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(null);

    await expect(
      ctx.availabilityService.setAvailability('non-existent-id', scheduleDto),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('PractitionersService — getAvailableSlots', () => {
  let ctx: PractitionersTestContext;

  beforeEach(async () => {
    ctx = await createPractitionersTestModule();
    jest.clearAllMocks();
  });

  function setupSlots(
    overrides: {
      vacation?: unknown;
      bookings?: unknown[];
      availability?: unknown[];
    } = {},
  ) {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerAvailability.findMany.mockResolvedValue(
      overrides.availability ??
        mockAvailability.filter((a) => a.dayOfWeek === 0),
    );
    ctx.mockPrisma.practitionerVacation.findFirst.mockResolvedValue(
      overrides.vacation ?? null,
    );
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue(
      overrides.vacation ? [overrides.vacation] : [],
    );
    ctx.mockPrisma.booking.findMany.mockResolvedValue(overrides.bookings ?? []);
  }

  it('should return available time slots for a given date', async () => {
    setupSlots();

    const result = await ctx.availabilityService.getAvailableSlots(
      mockPractitioner.id,
      '2026-04-05',
      30,
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(12);
    expect(result[0]).toHaveProperty('startTime');
    expect(result[0]).toHaveProperty('endTime');
  });

  it('should exclude slots that overlap with existing bookings', async () => {
    setupSlots({
      bookings: [
        { startTime: '09:00', endTime: '09:30', status: 'confirmed' },
        { startTime: '14:00', endTime: '14:30', status: 'pending' },
      ],
    });

    const result = await ctx.availabilityService.getAvailableSlots(
      mockPractitioner.id,
      '2026-04-05',
      30,
    );

    const startTimes = result.map((s: { startTime: string }) => s.startTime);
    expect(startTimes).not.toContain('09:00');
    expect(startTimes).not.toContain('14:00');
  });

  it('should return empty array if date falls on vacation', async () => {
    setupSlots({ vacation: mockVacation, availability: mockAvailability });

    const result = await ctx.availabilityService.getAvailableSlots(
      mockPractitioner.id,
      '2026-04-12',
      30,
    );

    expect(result).toEqual([]);
  });

  it('should return empty array if no availability on that day', async () => {
    setupSlots({ availability: [] });

    const result = await ctx.availabilityService.getAvailableSlots(
      mockPractitioner.id,
      '2026-04-04',
      30,
    );

    expect(result).toEqual([]);
  });

  it('should throw NotFoundException if practitioner not found', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(null);

    await expect(
      ctx.availabilityService.getAvailableSlots(
        'non-existent-id',
        '2026-04-05',
        30,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
