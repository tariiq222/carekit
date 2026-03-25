/**
 * Shared TestingModule factory for PractitionersService test suites.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PractitionersService } from '../practitioners.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { PractitionerAvailabilityService } from '../practitioner-availability.service.js';
import { PractitionerVacationService } from '../practitioner-vacation.service.js';
import { PractitionerServiceService } from '../practitioner-service.service.js';
import { PractitionerRatingsService } from '../practitioner-ratings.service.js';
import { PractitionerBreaksService } from '../practitioner-breaks.service.js';
import { createMockPrisma } from './practitioners.fixtures.js';

export interface PractitionersTestContext {
  service: PractitionersService;
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
    mockPrisma,
  };
}
