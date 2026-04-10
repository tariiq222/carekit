/**
 * Regression tests for CRITICAL fix #1:
 * Slot duration must match booking duration via full PriceResolverService chain.
 *
 * Before fix: resolveDurationForSlots only read sbt.duration (service type flat value)
 * After fix:  resolves through practitioner duration options → service duration options
 *             → practitioner type → service type (same chain as booking-creation.service.ts)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PractitionersService } from '../../../src/modules/practitioners/practitioners.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { PriceResolverService } from '../../../src/modules/bookings/price-resolver.service.js';

const mockPrisma = {
  serviceBookingType: {
    findUnique: jest.fn(),
  },
  practitionerService: {
    findUnique: jest.fn(),
  },
};

const mockPriceResolver = {
  resolve: jest.fn(),
};

describe('PractitionersService.resolveDurationForSlots', () => {
  let service: PractitionersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PriceResolverService, useValue: mockPriceResolver },
      ],
    }).compile();

    service = module.get(PractitionersService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario A: no practitionerId — service-level resolution only
  // ─────────────────────────────────────────────────────────────────────────

  it('returns sbt.duration when no practitionerId and no duration options', async () => {
    mockPrisma.serviceBookingType.findUnique.mockResolvedValue({
      duration: 45,
      durationOptions: [],
    });

    const result = await service.resolveDurationForSlots('svc-1', 'in_person');

    expect(result).toBe(45);
    expect(mockPriceResolver.resolve).not.toHaveBeenCalled();
  });

  it('returns default duration option durationMinutes when no practitionerId and option exists', async () => {
    // REGRESSION: before fix this was ignored — sbt.duration (30) was always returned
    mockPrisma.serviceBookingType.findUnique.mockResolvedValue({
      duration: 30,
      durationOptions: [{ id: 'opt-1', durationMinutes: 60, price: 200 }],
    });

    const result = await service.resolveDurationForSlots('svc-1', 'in_person');

    expect(result).toBe(60); // must use option, not sbt.duration=30
  });

  it('falls back to 30 when no practitionerId and sbt not found', async () => {
    mockPrisma.serviceBookingType.findUnique.mockResolvedValue(null);

    const result = await service.resolveDurationForSlots('svc-1', 'in_person');

    expect(result).toBe(30);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario B: practitionerId provided — use full PriceResolverService chain
  // ─────────────────────────────────────────────────────────────────────────

  it('uses PriceResolverService when practitionerId provided', async () => {
    mockPrisma.practitionerService.findUnique.mockResolvedValue({ id: 'ps-uuid' });
    mockPriceResolver.resolve.mockResolvedValue({ price: 150, duration: 75, source: 'practitioner_option' });

    const result = await service.resolveDurationForSlots('svc-1', 'in_person', 'prac-1');

    expect(result).toBe(75);
    expect(mockPriceResolver.resolve).toHaveBeenCalledWith({
      serviceId: 'svc-1',
      practitionerServiceId: 'ps-uuid',
      bookingType: 'in_person',
    });
  });

  it('falls back to service-level when practitioner does not offer the service', async () => {
    // ps not found → fall back to sbt
    mockPrisma.practitionerService.findUnique.mockResolvedValue(null);
    mockPrisma.serviceBookingType.findUnique.mockResolvedValue({
      duration: 50,
      durationOptions: [],
    });

    const result = await service.resolveDurationForSlots('svc-1', 'in_person', 'prac-1');

    expect(result).toBe(50);
    expect(mockPriceResolver.resolve).not.toHaveBeenCalled();
  });

  it('returns 30 (safe default) when PriceResolverService throws', async () => {
    mockPrisma.practitionerService.findUnique.mockResolvedValue({ id: 'ps-uuid' });
    mockPriceResolver.resolve.mockRejectedValue(new Error('booking type not active'));

    const result = await service.resolveDurationForSlots('svc-1', 'in_person', 'prac-1');

    expect(result).toBe(30); // non-blocking — must not propagate error
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRITICAL: slot duration must equal what booking-creation would use
  // This is the core regression test for the mismatch bug
  // ─────────────────────────────────────────────────────────────────────────

  it('REGRESSION: slot duration matches booking duration for practitioner with 60min option', async () => {
    // Setup: service has sbt.duration=30, but practitioner has a 60min option
    // Old behavior: resolveDurationForSlots returned 30 → slots every 30min
    // Booking creation: PriceResolverService returned 60 → booking takes 60min
    // Result: patient books a 30min slot but occupies 60min → double-booking possible
    //
    // New behavior: both must return 60

    mockPrisma.practitionerService.findUnique.mockResolvedValue({ id: 'ps-uuid' });
    mockPriceResolver.resolve.mockResolvedValue({
      price: 300,
      duration: 60,
      source: 'practitioner_option',
      durationOptionId: 'opt-60',
    });

    const slotDuration = await service.resolveDurationForSlots('svc-1', 'in_person', 'prac-1');

    // This must equal what booking-creation.service.ts would resolve
    expect(slotDuration).toBe(60);
    expect(slotDuration).not.toBe(30); // explicitly assert old wrong value is gone
  });
});
