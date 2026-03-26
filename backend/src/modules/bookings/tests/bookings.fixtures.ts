/**
 * Shared fixtures and mock factories for BookingsService test suites.
 * Import from this file in all bookings spec files.
 */

// ---------------------------------------------------------------------------
// DTO interfaces
// ---------------------------------------------------------------------------

export interface CreateBookingDto {
  practitionerId: string;
  serviceId: string;
  branchId?: string;
  type: 'clinic_visit' | 'phone_consultation' | 'video_consultation';
  date: string;
  startTime: string;
  notes?: string;
}

export interface RescheduleBookingDto {
  date?: string;
  startTime?: string;
}

export interface CancelApproveDto {
  refundType: 'full' | 'partial' | 'none';
  adminNotes?: string;
}

export interface CancelRejectDto {
  adminNotes?: string;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

export const mockPractitioner = {
  id: 'practitioner-uuid-1',
  userId: 'user-uuid-1',
  specialty: 'General Medicine',
  specialtyAr: 'الطب العام',
  isActive: true,
  isAcceptingBookings: true,
  deletedAt: null,
  user: { id: 'user-uuid-1', firstName: 'خالد', lastName: 'الفهد' },
};

export const mockService = {
  id: 'service-uuid-1',
  nameEn: 'General Consultation',
  nameAr: 'استشارة عامة',
  price: 15000,
  duration: 30,
  isActive: true,
  deletedAt: null,
};

export const mockPatientId = 'patient-uuid-1';
export const mockBranch = {
  id: 'branch-uuid-1',
  nameAr: 'الفرع الرئيسي',
  nameEn: 'Main Branch',
  isActive: true,
  deletedAt: null,
};

export const mockBooking = {
  id: 'booking-uuid-1',
  patientId: mockPatientId,
  branchId: null,
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
  branch: null,
  patient: { id: mockPatientId, firstName: 'أحمد', lastName: 'الراشد' },
  practitioner: mockPractitioner,
  service: mockService,
};

export const mockVideoBooking = {
  ...mockBooking,
  id: 'booking-uuid-2',
  type: 'video_consultation' as const,
  startTime: '14:00',
  endTime: '14:30',
  zoomMeetingId: 'zoom-123456',
  zoomJoinUrl: 'https://zoom.us/j/123456789',
  zoomHostUrl: 'https://zoom.us/s/123456789',
};

export const mockZoomMeeting = {
  meetingId: 'zoom-123456',
  joinUrl: 'https://zoom.us/j/123456789',
  hostUrl: 'https://zoom.us/s/123456789',
};

export const mockPractitionerService = {
  id: 'ps-uuid-1',
  practitionerId: mockPractitioner.id,
  serviceId: mockService.id,
  isActive: true,
  availableTypes: ['clinic_visit', 'phone_consultation', 'video_consultation'],
  customDuration: null,
  bufferMinutes: 0,
};

export const mockAvailability = [
  { dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true, branchId: null },
];

export const mockBookingSettings = {
  maxAdvanceBookingDays: 60,
  minBookingLeadMinutes: 0,
  allowWalkIn: true,
  suggestAlternativesOnConflict: false,
  adminCanBookOutsideHours: false,
  bufferMinutes: 0,
  paymentTimeoutMinutes: 60,
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockPrisma(): any {
  return {
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
      findUnique: jest.fn(),
    },
    branch: { findFirst: jest.fn() },
    practitionerBranch: { findUnique: jest.fn() },
    service: { findFirst: jest.fn() },
    practitionerService: { findUnique: jest.fn() },
    practitionerAvailability: { findMany: jest.fn() },
    practitionerVacation: { findMany: jest.fn(), findFirst: jest.fn() },
    payment: { findFirst: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
}

export function createMockZoom() {
  return {
    createMeeting: jest.fn(),
    deleteMeeting: jest.fn(),
  };
}

export function createMockCancellationService() {
  return {
    requestCancellation: jest.fn(),
    approveCancellation: jest.fn(),
    rejectCancellation: jest.fn(),
  };
}

export function createMockQueryService() {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findMyBookings: jest.fn(),
    findTodayBookings: jest.fn(),
    getBookingStats: jest.fn(),
  };
}

export function createMockNotificationsService() {
  return { createNotification: jest.fn().mockResolvedValue(undefined) };
}

export function createMockBookingStatusService(prisma: ReturnType<typeof createMockPrisma>) {
  return {
    confirm: jest.fn().mockImplementation(async (id: string) => {
      const booking = await prisma.booking.findFirst({ where: { id, deletedAt: null } });
      if (!booking) throw new (require('@nestjs/common').NotFoundException)({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
      if (booking.status !== 'pending') throw new (require('@nestjs/common').ConflictException)({ statusCode: 409, message: `Cannot confirm booking with status '${booking.status}'`, error: 'CONFLICT' });
      const payment = await prisma.payment.findFirst({ where: { bookingId: id } });
      if (!payment || payment.status !== 'paid') throw new (require('@nestjs/common').ConflictException)({ statusCode: 409, message: 'Payment is required', error: 'PAYMENT_REQUIRED' });
      return prisma.booking.update({ where: { id }, data: { status: 'confirmed', confirmedAt: new Date() } });
    }),
    complete: jest.fn().mockImplementation(async (id: string) => {
      const booking = await prisma.booking.findFirst({ where: { id, deletedAt: null } });
      if (!booking) throw new (require('@nestjs/common').NotFoundException)({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
      if (!['confirmed', 'checked_in', 'in_progress'].includes(booking.status)) throw new (require('@nestjs/common').ConflictException)({ statusCode: 409, message: `Cannot complete booking with status '${booking.status}'`, error: 'CONFLICT' });
      return prisma.booking.update({ where: { id }, data: { status: 'completed', completedAt: new Date() } });
    }),
    checkIn: jest.fn(),
    startSession: jest.fn(),
    markNoShow: jest.fn(),
  };
}

export const mockClinicHoursService = {
  getAll: jest.fn().mockResolvedValue(
    [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      startTime: '08:00',
      endTime: '20:00',
      isActive: true,
    })),
  ),
  getForDay: jest.fn().mockResolvedValue([
    { dayOfWeek: 1, startTime: '08:00', endTime: '20:00', isActive: true },
  ]),
};

export const mockClinicHolidaysService = {
  findAll: jest.fn().mockResolvedValue([]),
  isHoliday: jest.fn().mockResolvedValue(false),
};
