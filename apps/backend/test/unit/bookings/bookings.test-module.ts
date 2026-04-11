/**
 * Shared TestingModule factory for BookingsService test suites.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from '../../../src/modules/bookings/bookings.service.js';
import { BookingCreationService } from '../../../src/modules/bookings/booking-creation.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { BookingCancellationService } from '../../../src/modules/bookings/booking-cancellation.service.js';
import { BookingQueryService } from '../../../src/modules/bookings/booking-query.service.js';
import { ZoomService } from '../../../src/modules/integrations/zoom/zoom.service.js';
import { MessagingDispatcherService } from '../../../src/modules/messaging/core/messaging-dispatcher.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { BookingStatusService } from '../../../src/modules/bookings/booking-status.service.js';
import { BookingRescheduleService } from '../../../src/modules/bookings/booking-reschedule.service.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';
import { BookingPaymentHelper } from '../../../src/modules/bookings/booking-payment.helper.js';
import { PriceResolverService } from '../../../src/modules/bookings/price-resolver.service.js';
import { ClinicHoursService } from '../../../src/modules/clinic/clinic-hours.service.js';
import { ClinicHolidaysService } from '../../../src/modules/clinic/clinic-holidays.service.js';
import { ClinicSettingsService } from '../../../src/modules/clinic-settings/clinic-settings.service.js';
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
  mockBookingSettingsService: {
    get: jest.Mock;
    getForBranch: jest.Mock;
  };
}

export async function createBookingsTestModule(): Promise<BookingsTestContext> {
  const mockPrisma = createMockPrisma();
  const mockZoom = createMockZoom();
  const mockCancellationService = createMockCancellationService();
  const mockQueryService = createMockQueryService();
  const mockNotificationsService = createMockNotificationsService();
  const mockBookingSettingsService = {
    get: jest.fn().mockResolvedValue(mockBookingSettings),
    getForBranch: jest.fn().mockResolvedValue(mockBookingSettings),
  };

  mockPrisma.$transaction.mockImplementation(
    (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
  );

  const mockPaymentHelper = {
    resolvePatientId: jest
      .fn()
      .mockImplementation((_caller: string, patientId?: string) =>
        Promise.resolve(patientId ?? _caller),
      ),
    createPaymentIfNeeded: jest.fn().mockResolvedValue(undefined),
  };
  const mockPriceResolver = {
    resolve: jest.fn().mockResolvedValue({
      price: 20000,
      duration: 30,
      source: 'service_type',
    }),
  };
  const mockActivityLog = { log: jest.fn().mockResolvedValue(undefined) };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      BookingsService,
      BookingCreationService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: ZoomService, useValue: mockZoom },
      {
        provide: BookingCancellationService,
        useValue: mockCancellationService,
      },
      { provide: BookingQueryService, useValue: mockQueryService },
      { provide: MessagingDispatcherService, useValue: mockNotificationsService },
      { provide: BookingSettingsService, useValue: mockBookingSettingsService },
      {
        provide: BookingStatusService,
        useValue: createMockBookingStatusService(mockPrisma),
      },
      BookingRescheduleService,
      { provide: ActivityLogService, useValue: mockActivityLog },
      { provide: BookingPaymentHelper, useValue: mockPaymentHelper },
      { provide: PriceResolverService, useValue: mockPriceResolver },
      { provide: ClinicHoursService, useValue: mockClinicHoursService },
      { provide: ClinicHolidaysService, useValue: mockClinicHolidaysService },
      {
        provide: ClinicSettingsService,
        useValue: { getTimezone: jest.fn().mockResolvedValue('Asia/Riyadh') },
      },
    ],
  }).compile();

  return {
    service: module.get<BookingsService>(BookingsService),
    mockPrisma,
    mockZoom,
    mockCancellationService,
    mockQueryService,
    mockNotificationsService,
    mockBookingSettingsService,
  };
}
