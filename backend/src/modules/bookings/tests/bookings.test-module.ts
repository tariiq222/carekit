/**
 * Shared TestingModule factory for BookingsService test suites.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from '../bookings.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { BookingCancellationService } from '../booking-cancellation.service.js';
import { BookingQueryService } from '../booking-query.service.js';
import { ZoomService } from '../../integrations/zoom/zoom.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { BookingSettingsService } from '../booking-settings.service.js';
import { BookingStatusService } from '../booking-status.service.js';
import { ActivityLogService } from '../../activity-log/activity-log.service.js';
import { BookingPaymentHelper } from '../booking-payment.helper.js';
import { PriceResolverService } from '../price-resolver.service.js';
import { ClinicHoursService } from '../../clinic/clinic-hours.service.js';
import { ClinicHolidaysService } from '../../clinic/clinic-holidays.service.js';
import {
  createMockPrisma,
  createMockZoom,
  createMockCancellationService,
  createMockQueryService,
  createMockNotificationsService,
  createMockBookingStatusService,
  mockBookingSettings,
  mockClinicHoursService,
  mockClinicHolidaysService,
} from './bookings.fixtures.js';

export interface BookingsTestContext {
  service: BookingsService;
  mockPrisma: ReturnType<typeof createMockPrisma>;
  mockZoom: ReturnType<typeof createMockZoom>;
  mockCancellationService: ReturnType<typeof createMockCancellationService>;
  mockQueryService: ReturnType<typeof createMockQueryService>;
  mockNotificationsService: ReturnType<typeof createMockNotificationsService>;
}

export async function createBookingsTestModule(): Promise<BookingsTestContext> {
  const mockPrisma = createMockPrisma();
  const mockZoom = createMockZoom();
  const mockCancellationService = createMockCancellationService();
  const mockQueryService = createMockQueryService();
  const mockNotificationsService = createMockNotificationsService();

  mockPrisma.$transaction.mockImplementation(
    (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
  );

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      BookingsService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: ZoomService, useValue: mockZoom },
      { provide: BookingCancellationService, useValue: mockCancellationService },
      { provide: BookingQueryService, useValue: mockQueryService },
      { provide: NotificationsService, useValue: mockNotificationsService },
      { provide: BookingSettingsService, useValue: { get: jest.fn().mockResolvedValue(mockBookingSettings) } },
      { provide: BookingStatusService, useValue: createMockBookingStatusService(mockPrisma) },
      { provide: ActivityLogService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      {
        provide: BookingPaymentHelper,
        useValue: {
          resolvePatientId: jest.fn().mockImplementation((_caller: string, patientId?: string) =>
            Promise.resolve(patientId ?? _caller),
          ),
          createPaymentIfNeeded: jest.fn().mockResolvedValue(undefined),
        },
      },
      {
        provide: PriceResolverService,
        useValue: {
          resolve: jest.fn().mockRejectedValue(new Error('ServiceBookingType not configured')),
        },
      },
      { provide: ClinicHoursService, useValue: mockClinicHoursService },
      { provide: ClinicHolidaysService, useValue: mockClinicHolidaysService },
    ],
  }).compile();

  return {
    service: module.get<BookingsService>(BookingsService),
    mockPrisma,
    mockZoom,
    mockCancellationService,
    mockQueryService,
    mockNotificationsService,
  };
}
