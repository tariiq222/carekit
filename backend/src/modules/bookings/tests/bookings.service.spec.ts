/**
 * CareKit — BookingsService Unit Tests (TDD RED Phase)
 *
 * Tests the BookingsService business logic in isolation:
 *   - Create booking (double-booking protection, Zoom link generation, endTime calculation)
 *   - List bookings (pagination, filters: status/type/practitioner/patient/date range)
 *   - Get booking by ID (with relations)
 *   - Reschedule booking (conflict detection)
 *   - Confirm booking (state transition: pending → confirmed)
 *   - Complete booking (state transition: confirmed → completed)
 *   - Cancel request (state transition: confirmed → pending_cancellation)
 *   - Approve cancellation (state transition: pending_cancellation → cancelled + refund decision)
 *   - Reject cancellation (state transition: pending_cancellation → confirmed)
 *   - Patient's own bookings (/my)
 *   - Practitioner's today bookings (/today)
 *
 * PrismaService and ZoomService are mocked so tests run without external services.
 * These tests will FAIL until backend-dev implements BookingsService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingsService } from '../bookings.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { BookingCancellationService } from '../booking-cancellation.service.js';
import { BookingQueryService } from '../booking-query.service.js';
import { ZoomService } from '../zoom.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';

// ---------------------------------------------------------------------------
// DTO interfaces (replaced by actual imports once backend-dev creates them)
// ---------------------------------------------------------------------------

interface CreateBookingDto {
  practitionerId: string;
  serviceId: string;
  type: 'clinic_visit' | 'phone_consultation' | 'video_consultation';
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  notes?: string;
}

interface RescheduleBookingDto {
  date?: string;
  startTime?: string;
}

interface CancelApproveDto {
  refundType: 'full' | 'partial' | 'none';
  adminNotes?: string;
}

interface CancelRejectDto {
  adminNotes?: string;
}

interface BookingListQuery {
  page?: number;
  perPage?: number;
  status?: string;
  type?: string;
  practitionerId?: string;
  patientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaService: any = {
  booking: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  practitioner: {
    findFirst: jest.fn(),
  },
  service: {
    findFirst: jest.fn(),
  },
  practitionerService: {
    findUnique: jest.fn(),
  },
  practitionerAvailability: {
    findMany: jest.fn(),
  },
  practitionerVacation: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  payment: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrismaService)),
};

// Mock ZoomService for video consultation link generation
const mockZoomService = {
  createMeeting: jest.fn(),
  deleteMeeting: jest.fn(),
};

// Mock BookingCancellationService (cancellation logic delegated from BookingsService)
const mockCancellationService = {
  requestCancellation: jest.fn(),
  approveCancellation: jest.fn(),
  rejectCancellation: jest.fn(),
};

// Mock BookingQueryService
const mockQueryService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findMyBookings: jest.fn(),
  findTodayBookings: jest.fn(),
  getBookingStats: jest.fn(),
};

// Mock NotificationsService
const mockNotificationsService = {
  createNotification: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockPractitioner = {
  id: 'practitioner-uuid-1',
  userId: 'user-uuid-1',
  specialtyId: 'specialty-uuid-1',
  isActive: true,
  deletedAt: null,
  user: {
    id: 'user-uuid-1',
    firstName: 'خالد',
    lastName: 'الفهد',
  },
  specialty: {
    nameEn: 'Cardiology',
    nameAr: 'أمراض القلب',
  },
};

const mockService = {
  id: 'service-uuid-1',
  nameEn: 'General Consultation',
  nameAr: 'استشارة عامة',
  price: 15000,
  duration: 30, // minutes
  isActive: true,
  deletedAt: null,
};

const mockPatientId = 'patient-uuid-1';

const mockBooking = {
  id: 'booking-uuid-1',
  patientId: mockPatientId,
  practitionerId: mockPractitioner.id,
  serviceId: mockService.id,
  type: 'clinic_visit' as const,
  date: new Date('2026-06-01'),
  startTime: '09:00',
  endTime: '09:30',
  status: 'pending' as const,
  notes: 'أول زيارة',
  zoomMeetingId: null,
  zoomJoinUrl: null,
  zoomHostUrl: null,
  cancellationReason: null,
  cancelledAt: null,
  confirmedAt: null,
  completedAt: null,
  deletedAt: null,
  createdAt: new Date('2026-03-20'),
  updatedAt: new Date('2026-03-20'),
  patient: {
    id: mockPatientId,
    firstName: 'أحمد',
    lastName: 'الراشد',
  },
  practitioner: mockPractitioner,
  service: mockService,
};

const mockVideoBooking = {
  ...mockBooking,
  id: 'booking-uuid-2',
  type: 'video_consultation' as const,
  startTime: '14:00',
  endTime: '14:30',
  zoomMeetingId: 'zoom-123456',
  zoomJoinUrl: 'https://zoom.us/j/123456789',
  zoomHostUrl: 'https://zoom.us/s/123456789',
};

const mockZoomMeeting = {
  meetingId: 'zoom-123456',
  joinUrl: 'https://zoom.us/j/123456789',
  hostUrl: 'https://zoom.us/s/123456789',
};

const mockPractitionerService = {
  id: 'ps-uuid-1',
  practitionerId: mockPractitioner.id,
  serviceId: mockService.id,
  isActive: true,
  availableTypes: ['clinic_visit', 'phone_consultation', 'video_consultation'],
  customDuration: null,
  bufferBefore: 0,
  bufferAfter: 0,
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ZoomService, useValue: mockZoomService },
        { provide: BookingCancellationService, useValue: mockCancellationService },
        { provide: BookingQueryService, useValue: mockQueryService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create — Create Booking
  // ─────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateBookingDto = {
      practitionerId: mockPractitioner.id,
      serviceId: mockService.id,
      type: 'clinic_visit',
      date: '2026-06-01',
      startTime: '09:00',
      notes: 'أول زيارة',
    };

    it('should create a clinic_visit booking', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([{ dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true }]);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([]); // no conflicts
      mockPrismaService.booking.create.mockResolvedValue(mockBooking);

      const result = await service.create(mockPatientId, createDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockBooking.id);
      expect(result.status).toBe('pending');
      expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId: mockPatientId,
            practitionerId: createDto.practitionerId,
            serviceId: createDto.serviceId,
            type: 'clinic_visit',
            startTime: '09:00',
          }),
        }),
      );
    });

    it('should auto-calculate endTime from service duration', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.service.findFirst.mockResolvedValue(mockService); // 30 min
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([{ dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true }]);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.booking.create.mockResolvedValue(mockBooking);

      await service.create(mockPatientId, createDto);

      expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startTime: '09:00',
            endTime: '09:30', // 09:00 + 30 min
          }),
        }),
      );
    });

    it('should generate Zoom links for video_consultation', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([{ dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true }]);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockZoomService.createMeeting.mockResolvedValue(mockZoomMeeting);
      mockPrismaService.booking.create.mockResolvedValue(mockVideoBooking);

      const result = await service.create(mockPatientId, {
        ...createDto,
        type: 'video_consultation',
        startTime: '14:00',
      });

      expect(mockZoomService.createMeeting).toHaveBeenCalled();
      expect(result.zoomJoinUrl).toBeDefined();
      expect(result.zoomHostUrl).toBeDefined();
    });

    it('should NOT generate Zoom links for clinic_visit', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([{ dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true }]);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.booking.create.mockResolvedValue(mockBooking);

      await service.create(mockPatientId, createDto);

      expect(mockZoomService.createMeeting).not.toHaveBeenCalled();
    });

    it('should NOT generate Zoom links for phone_consultation', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([{ dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true }]);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.booking.create.mockResolvedValue({
        ...mockBooking,
        type: 'phone_consultation',
      });

      await service.create(mockPatientId, {
        ...createDto,
        type: 'phone_consultation',
      });

      expect(mockZoomService.createMeeting).not.toHaveBeenCalled();
    });

    it('should throw ConflictException for double-booking', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([{ dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true }]);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([mockBooking]); // Existing booking at same time

      await expect(
        service.create(mockPatientId, createDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if practitioner not found', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(null);

      await expect(
        service.create(mockPatientId, createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if service not found', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.service.findFirst.mockResolvedValue(null);

      await expect(
        service.create(mockPatientId, createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for past dates', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);

      await expect(
        service.create(mockPatientId, {
          ...createDto,
          date: '2024-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set initial status to pending', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([{ dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true }]);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.booking.create.mockResolvedValue(mockBooking);

      const result = await service.create(mockPatientId, createDto);

      expect(result.status).toBe('pending');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll — List Bookings
  // ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated bookings with default page=1, perPage=20', async () => {
      mockQueryService.findAll.mockResolvedValue({
        items: [mockBooking],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      });

      const result = await service.findAll({});

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toMatchObject({
        page: 1,
        perPage: 20,
        total: 1,
      });
      expect(mockQueryService.findAll).toHaveBeenCalledWith({});
    });

    it('should apply pagination', async () => {
      mockQueryService.findAll.mockResolvedValue({
        items: [],
        meta: { page: 3, perPage: 10, total: 50, totalPages: 5 },
      });

      const result = await service.findAll({ page: 3, perPage: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.totalPages).toBe(5);
      expect(mockQueryService.findAll).toHaveBeenCalledWith({ page: 3, perPage: 10 });
    });

    it('should filter by status', async () => {
      mockQueryService.findAll.mockResolvedValue({
        items: [mockBooking],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      });

      await service.findAll({ status: 'pending' });

      expect(mockQueryService.findAll).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('should filter by type', async () => {
      mockQueryService.findAll.mockResolvedValue({
        items: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      await service.findAll({ type: 'video_consultation' });

      expect(mockQueryService.findAll).toHaveBeenCalledWith({ type: 'video_consultation' });
    });

    it('should filter by practitionerId', async () => {
      mockQueryService.findAll.mockResolvedValue({
        items: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      await service.findAll({ practitionerId: mockPractitioner.id });

      expect(mockQueryService.findAll).toHaveBeenCalledWith({ practitionerId: mockPractitioner.id });
    });

    it('should filter by patientId', async () => {
      mockQueryService.findAll.mockResolvedValue({
        items: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      await service.findAll({ patientId: mockPatientId });

      expect(mockQueryService.findAll).toHaveBeenCalledWith({ patientId: mockPatientId });
    });

    it('should filter by date range', async () => {
      mockQueryService.findAll.mockResolvedValue({
        items: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      await service.findAll({
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
      });

      expect(mockQueryService.findAll).toHaveBeenCalledWith({
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
      });
    });

    it('should exclude soft-deleted bookings', async () => {
      mockQueryService.findAll.mockResolvedValue({
        items: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      await service.findAll({});

      // Soft-delete filtering is handled by queryService
      expect(mockQueryService.findAll).toHaveBeenCalledWith({});
    });

    it('should include patient, practitioner, and service relations', async () => {
      mockQueryService.findAll.mockResolvedValue({
        items: [mockBooking],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      });

      await service.findAll({});

      // Relations are handled by queryService
      expect(mockQueryService.findAll).toHaveBeenCalledWith({});
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne — Get Booking by ID
  // ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a booking with all relations', async () => {
      mockQueryService.findOne.mockResolvedValue(mockBooking);

      const result = await service.findOne(mockBooking.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockBooking.id);
      expect(result.patient).toBeDefined();
      expect(result.practitioner).toBeDefined();
      expect(result.service).toBeDefined();
      expect(mockQueryService.findOne).toHaveBeenCalledWith(mockBooking.id);
    });

    it('should throw NotFoundException for non-existent booking', async () => {
      mockQueryService.findOne.mockRejectedValue(
        new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' }),
      );

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // reschedule — Reschedule Booking
  // ─────────────────────────────────────────────────────────────

  describe('reschedule', () => {
    it('should create a new booking with updated date and time', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        practitionerServiceId: mockPractitionerService.id,
      });
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([{ dayOfWeek: 2, startTime: '08:00', endTime: '18:00', isActive: true }]);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([]); // no conflicts
      mockPrismaService.booking.create.mockResolvedValue({
        ...mockBooking,
        id: 'new-booking-id',
        date: new Date('2026-06-03'),
        startTime: '10:00',
        endTime: '10:30',
      });
      mockPrismaService.booking.update.mockResolvedValue({});
      mockPrismaService.payment.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.reschedule(mockBooking.id, {
        date: '2026-06-03',
        startTime: '10:00',
      });

      expect(result.startTime).toBe('10:00');
      expect(mockPrismaService.booking.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if new time conflicts', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        practitionerServiceId: mockPractitionerService.id,
      });
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([{ dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true }]);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([
        { ...mockBooking, id: 'other-booking', startTime: '10:00', endTime: '10:30' },
      ]);

      await expect(
        service.reschedule(mockBooking.id, {
          date: '2026-06-01',
          startTime: '10:00',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.reschedule('non-existent-id', { date: '2026-06-03' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should recalculate endTime when startTime changes', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        practitionerServiceId: mockPractitionerService.id,
      });
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
      mockPrismaService.service.findFirst.mockResolvedValue(mockService); // 30 min
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([{ dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true }]);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.booking.create.mockResolvedValue({
        ...mockBooking,
        id: 'new-booking-id',
        startTime: '15:00',
        endTime: '15:30',
      });
      mockPrismaService.booking.update.mockResolvedValue({});
      mockPrismaService.payment.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.reschedule(mockBooking.id, { startTime: '15:00' });

      expect(result.startTime).toBe('15:00');
      expect(result.endTime).toBe('15:30');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // confirm — Confirm Booking
  // ─────────────────────────────────────────────────────────────

  describe('confirm', () => {
    it('should transition from pending to confirmed', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking); // status: pending
      mockPrismaService.payment.findFirst.mockResolvedValue({ id: 'pay-1', bookingId: mockBooking.id, status: 'paid' });
      mockPrismaService.booking.update.mockResolvedValue({
        ...mockBooking,
        status: 'confirmed',
        confirmedAt: new Date(),
      });

      const result = await service.confirm(mockBooking.id);

      expect(result.status).toBe('confirmed');
      expect(result.confirmedAt).toBeDefined();
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'confirmed',
            confirmedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw ConflictException if already confirmed', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        status: 'confirmed',
      });

      await expect(service.confirm(mockBooking.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(null);

      await expect(service.confirm('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if booking is completed', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        status: 'completed',
      });

      await expect(service.confirm(mockBooking.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if booking is cancelled', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        status: 'cancelled',
      });

      await expect(service.confirm(mockBooking.id)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // complete — Complete Booking
  // ─────────────────────────────────────────────────────────────

  describe('complete', () => {
    it('should transition from confirmed to completed', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        status: 'confirmed',
      });
      mockPrismaService.booking.update.mockResolvedValue({
        ...mockBooking,
        status: 'completed',
        completedAt: new Date(),
      });

      const result = await service.complete(mockBooking.id);

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
    });

    it('should throw ConflictException if booking is still pending (must confirm first)', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking); // status: pending

      await expect(service.complete(mockBooking.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if already completed', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        status: 'completed',
      });

      await expect(service.complete(mockBooking.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(null);

      await expect(service.complete('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // requestCancellation — Patient requests cancellation
  // ─────────────────────────────────────────────────────────────

  describe('requestCancellation', () => {
    it('should transition confirmed booking to pending_cancellation', async () => {
      const cancellationResult = {
        ...mockBooking,
        status: 'pending_cancellation',
        cancellationReason: 'تعارض في الجدول',
      };
      mockCancellationService.requestCancellation.mockResolvedValue(cancellationResult);

      const result = await service.requestCancellation(
        mockBooking.id,
        mockPatientId,
        'تعارض في الجدول',
      );

      expect(result.status).toBe('pending_cancellation');
      expect(result.cancellationReason).toBe('تعارض في الجدول');
      expect(mockCancellationService.requestCancellation).toHaveBeenCalledWith(
        mockBooking.id,
        mockPatientId,
        'تعارض في الجدول',
      );
    });

    it('should throw ForbiddenException if patient is not the owner', async () => {
      mockCancellationService.requestCancellation.mockRejectedValue(
        new ForbiddenException({
          statusCode: 403,
          message: 'You can only request cancellation for your own bookings',
          error: 'FORBIDDEN',
        }),
      );

      await expect(
        service.requestCancellation(
          mockBooking.id,
          'different-patient-id',
          'Not my booking',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if already pending_cancellation', async () => {
      mockCancellationService.requestCancellation.mockRejectedValue(
        new ConflictException({
          statusCode: 409,
          message: "Cannot request cancellation for booking with status 'pending_cancellation'",
          error: 'CONFLICT',
        }),
      );

      await expect(
        service.requestCancellation(mockBooking.id, mockPatientId, 'Duplicate'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if booking is already cancelled', async () => {
      mockCancellationService.requestCancellation.mockRejectedValue(
        new ConflictException({
          statusCode: 409,
          message: "Cannot request cancellation for booking with status 'cancelled'",
          error: 'CONFLICT',
        }),
      );

      await expect(
        service.requestCancellation(mockBooking.id, mockPatientId, 'Too late'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockCancellationService.requestCancellation.mockRejectedValue(
        new NotFoundException({
          statusCode: 404,
          message: 'Booking not found',
          error: 'NOT_FOUND',
        }),
      );

      await expect(
        service.requestCancellation('non-existent-id', mockPatientId, 'Test'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // approveCancellation — Admin approves cancellation
  // ─────────────────────────────────────────────────────────────

  describe('approveCancellation', () => {
    const approveDto: CancelApproveDto = {
      refundType: 'full',
      adminNotes: 'Approved per clinic policy',
    };

    it('should transition pending_cancellation to cancelled', async () => {
      const cancelledResult = {
        ...mockBooking,
        status: 'cancelled',
        cancelledAt: new Date(),
      };
      mockCancellationService.approveCancellation.mockResolvedValue(cancelledResult);

      const result = await service.approveCancellation(mockBooking.id, approveDto);

      expect(result.status).toBe('cancelled');
      expect(result.cancelledAt).toBeDefined();
      expect(mockCancellationService.approveCancellation).toHaveBeenCalledWith(
        mockBooking.id,
        approveDto,
      );
    });

    it('should throw ConflictException if not in pending_cancellation state', async () => {
      mockCancellationService.approveCancellation.mockRejectedValue(
        new ConflictException({
          statusCode: 409,
          message: "Cannot approve cancellation for booking with status 'confirmed'",
          error: 'CONFLICT',
        }),
      );

      await expect(
        service.approveCancellation(mockBooking.id, approveDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockCancellationService.approveCancellation.mockRejectedValue(
        new NotFoundException({
          statusCode: 404,
          message: 'Booking not found',
          error: 'NOT_FOUND',
        }),
      );

      await expect(
        service.approveCancellation('non-existent-id', approveDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should accept all valid refund types (full, partial, none)', async () => {
      for (const refundType of ['full', 'partial', 'none'] as const) {
        mockCancellationService.approveCancellation.mockResolvedValue({
          ...mockBooking,
          status: 'cancelled',
          cancelledAt: new Date(),
        });

        const result = await service.approveCancellation(mockBooking.id, {
          refundType,
          adminNotes: `${refundType} refund`,
        });

        expect(result.status).toBe('cancelled');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // rejectCancellation — Admin rejects cancellation
  // ─────────────────────────────────────────────────────────────

  describe('rejectCancellation', () => {
    it('should transition pending_cancellation back to confirmed', async () => {
      const rejectedResult = {
        ...mockBooking,
        status: 'confirmed',
        cancellationReason: null,
      };
      mockCancellationService.rejectCancellation.mockResolvedValue(rejectedResult);

      const result = await service.rejectCancellation(mockBooking.id, {
        adminNotes: 'Cannot cancel within 24 hours',
      });

      expect(result.status).toBe('confirmed');
      expect(mockCancellationService.rejectCancellation).toHaveBeenCalledWith(
        mockBooking.id,
        { adminNotes: 'Cannot cancel within 24 hours' },
      );
    });

    it('should throw ConflictException if not in pending_cancellation state', async () => {
      mockCancellationService.rejectCancellation.mockRejectedValue(
        new ConflictException({
          statusCode: 409,
          message: "Cannot reject cancellation for booking with status 'confirmed'",
          error: 'CONFLICT',
        }),
      );

      await expect(
        service.rejectCancellation(mockBooking.id, {}),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockCancellationService.rejectCancellation.mockRejectedValue(
        new NotFoundException({
          statusCode: 404,
          message: 'Booking not found',
          error: 'NOT_FOUND',
        }),
      );

      await expect(
        service.rejectCancellation('non-existent-id', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findMyBookings — Patient's own bookings
  // ─────────────────────────────────────────────────────────────

  describe('findMyBookings', () => {
    it('should return only bookings belonging to the patient', async () => {
      mockQueryService.findMyBookings.mockResolvedValue({
        items: [mockBooking],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      });

      const result = await service.findMyBookings(mockPatientId);

      expect(mockQueryService.findMyBookings).toHaveBeenCalledWith(mockPatientId);
      expect(result.items).toHaveLength(1);
    });

    it('should return empty list for patient with no bookings', async () => {
      mockQueryService.findMyBookings.mockResolvedValue({
        items: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      const result = await service.findMyBookings('new-patient-id');

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findTodayBookings — Practitioner's today bookings
  // ─────────────────────────────────────────────────────────────

  describe('findTodayBookings', () => {
    it('should delegate to queryService', async () => {
      mockQueryService.findTodayBookings.mockResolvedValue([]);

      const result = await service.findTodayBookings(mockPractitioner.userId);

      expect(mockQueryService.findTodayBookings).toHaveBeenCalledWith(mockPractitioner.userId);
    });

    it('should throw NotFoundException if user is not a practitioner', async () => {
      mockQueryService.findTodayBookings.mockRejectedValue(
        new NotFoundException({ statusCode: 404, message: 'Practitioner not found', error: 'NOT_FOUND' }),
      );

      await expect(
        service.findTodayBookings('non-practitioner-user-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return results from queryService', async () => {
      mockQueryService.findTodayBookings.mockResolvedValue([mockBooking]);

      const result = await service.findTodayBookings(mockPractitioner.userId);

      expect(result).toEqual([mockBooking]);
      expect(mockQueryService.findTodayBookings).toHaveBeenCalledWith(mockPractitioner.userId);
    });
  });
});
