/**
 * Shared TestingModule factory for PractitionersService test suites.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PractitionersService } from '../../../src/modules/practitioners/practitioners.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { PractitionerAvailabilityService } from '../../../src/modules/practitioners/practitioner-availability.service.js';
import { PractitionerVacationService } from '../../../src/modules/practitioners/practitioner-vacation.service.js';
import { PractitionerServiceService } from '../../../src/modules/practitioners/practitioner-service.service.js';
import { PractitionerRatingsService } from '../../../src/modules/practitioners/practitioner-ratings.service.js';
import { PractitionerBreaksService } from '../../../src/modules/practitioners/practitioner-breaks.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { createMockPrisma } from './practitioners.fixtures.js';

export interface PractitionersTestContext {
  service: PractitionersService;
  availabilityService: PractitionerAvailabilityService;
  vacationService: PractitionerVacationService;
  mockPrisma: ReturnType<typeof createMockPrisma>;
}

export async function createPractitionersTestModule(): Promise<PractitionersTestContext> {
  const mockPrisma = createMockPrisma();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PractitionersService,
      PractitionerAvailabilityService,
      PractitionerVacationService,
      PractitionerServiceService,
      { provide: PrismaService, useValue: mockPrisma },
      {
        provide: BookingSettingsService,
        useValue: {
          get: jest.fn(),
          getForBranch: jest.fn().mockResolvedValue({
            bufferMinutes: 0,
            minBookingLeadMinutes: 0,
          }),
        },
      },
      {
        provide: PractitionerRatingsService,
        useValue: {
          getRatings: jest.fn().mockResolvedValue({
            items: [],
            meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
          }),
        },
      },
      {
        provide: PractitionerBreaksService,
        useValue: {
          getBreaks: jest.fn().mockResolvedValue([]),
          setBreaks: jest.fn().mockResolvedValue([]),
        },
      },
    ],
  }).compile();

  return {
    service: module.get<PractitionersService>(PractitionersService),
    availabilityService: module.get<PractitionerAvailabilityService>(PractitionerAvailabilityService),
    vacationService: module.get<PractitionerVacationService>(PractitionerVacationService),
    mockPrisma,
  };
}
