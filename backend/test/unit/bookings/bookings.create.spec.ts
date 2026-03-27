/**
 * BookingsService — Create & Reschedule Tests
 * Covers: create booking, endTime calculation, Zoom link generation, double-booking, reschedule
 */
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { createBookingsTestModule, BookingsTestContext } from './bookings.test-module.js';
import {
  mockPractitioner,
  mockService,
  mockPatientId,
  mockBooking,
  mockVideoBooking,
  mockZoomMeeting,
  mockPractitionerService,
  mockAvailability,
  mockBranch,
} from './bookings.fixtures.js';

describe('BookingsService — create', () => {
  let ctx: BookingsTestContext;
  const futureDateString = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const createDto = {
    practitionerId: mockPractitioner.id,
    serviceId: mockService.id,
    type: 'clinic_visit' as const,
    date: futureDateString(10),
    startTime: '09:00',
    notes: 'أول زيارة',
  };

  function setupHappyPath() {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.service.findFirst.mockResolvedValue(mockService);
    ctx.mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
    ctx.mockPrisma.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);
    ctx.mockPrisma.practitionerVacation.findFirst.mockResolvedValue(null);
    ctx.mockPrisma.booking.findMany.mockResolvedValue([]);
  }

  beforeEach(async () => {
    ctx = await createBookingsTestModule();
    jest.clearAllMocks();
  });

  it('should create a clinic_visit booking with status pending', async () => {
    setupHappyPath();
    ctx.mockPrisma.booking.create.mockResolvedValue(mockBooking);

    const result = await ctx.service.create(mockPatientId, createDto);

    expect(result.id).toBe(mockBooking.id);
    expect(result.status).toBe('pending');
    expect(ctx.mockPrisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: mockPatientId,
          practitionerId: createDto.practitionerId,
          type: 'clinic_visit',
          startTime: '09:00',
        }),
      }),
    );
  });

  it('should auto-calculate endTime from service duration (30 min)', async () => {
    setupHappyPath();
    ctx.mockPrisma.booking.create.mockResolvedValue(mockBooking);

    await ctx.service.create(mockPatientId, createDto);

    expect(ctx.mockPrisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ startTime: '09:00', endTime: '09:30' }),
      }),
    );
  });

  it('should generate Zoom links for video_consultation', async () => {
    setupHappyPath();
    ctx.mockZoom.createMeeting.mockResolvedValue(mockZoomMeeting);
    ctx.mockPrisma.booking.create.mockResolvedValue(mockVideoBooking);

    const result = await ctx.service.create(mockPatientId, {
      ...createDto,
      type: 'video_consultation',
      startTime: '14:00',
    });

    expect(ctx.mockZoom.createMeeting).toHaveBeenCalled();
    expect(result.zoomJoinUrl).toBeDefined();
    expect(result.zoomHostUrl).toBeDefined();
  });

  it.each([
    ['clinic_visit' as const],
    ['phone_consultation' as const],
  ])('should NOT generate Zoom links for %s', async (type) => {
    setupHappyPath();
    ctx.mockPrisma.booking.create.mockResolvedValue({ ...mockBooking, type });

    await ctx.service.create(mockPatientId, { ...createDto, type });

    expect(ctx.mockZoom.createMeeting).not.toHaveBeenCalled();
  });

  it('should throw ConflictException for double-booking', async () => {
    setupHappyPath();
    ctx.mockPrisma.booking.findMany.mockResolvedValue([mockBooking]); // conflict

    await expect(ctx.service.create(mockPatientId, createDto)).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if practitioner not found', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(null);

    await expect(ctx.service.create(mockPatientId, createDto)).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException if service not found', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.service.findFirst.mockResolvedValue(null);

    await expect(ctx.service.create(mockPatientId, createDto)).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException for past dates', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.service.findFirst.mockResolvedValue(mockService);
    ctx.mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);

    await expect(
      ctx.service.create(mockPatientId, { ...createDto, date: '2024-01-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should persist branchId and load branch-specific settings when branchId is provided', async () => {
    setupHappyPath();
    ctx.mockPrisma.branch.findFirst.mockResolvedValue(mockBranch);
    ctx.mockPrisma.practitionerBranch.findUnique.mockResolvedValue({ id: 'pb-1' });
    ctx.mockPrisma.booking.create.mockResolvedValue({ ...mockBooking, branchId: mockBranch.id });

    const result = await ctx.service.create(mockPatientId, {
      ...createDto,
      branchId: mockBranch.id,
    });

    expect(ctx.mockBookingSettingsService.getForBranch).toHaveBeenCalledWith(mockBranch.id);
    expect(ctx.mockPrisma.practitionerAvailability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ branchId: mockBranch.id }, { branchId: null }],
        }),
      }),
    );
    expect(ctx.mockPrisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ branchId: mockBranch.id }),
      }),
    );
    expect(result.branchId).toBe(mockBranch.id);
  });

  it('should reject branch-scoped booking when practitioner is not assigned to the branch', async () => {
    setupHappyPath();
    ctx.mockPrisma.branch.findFirst.mockResolvedValue(mockBranch);
    ctx.mockPrisma.practitionerBranch.findUnique.mockResolvedValue(null);

    await expect(
      ctx.service.create(mockPatientId, { ...createDto, branchId: mockBranch.id }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('BookingsService — reschedule', () => {
  let ctx: BookingsTestContext;

  beforeEach(async () => {
    ctx = await createBookingsTestModule();
    jest.clearAllMocks();
  });

  function setupReschedulePath(conflicts: unknown[] = []) {
    ctx.mockPrisma.booking.findFirst.mockResolvedValue({
      ...mockBooking,
      practitionerServiceId: mockPractitionerService.id,
    });
    ctx.mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPractitionerService);
    ctx.mockPrisma.service.findFirst.mockResolvedValue(mockService);
    ctx.mockPrisma.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);
    ctx.mockPrisma.practitionerVacation.findFirst.mockResolvedValue(null);
    ctx.mockPrisma.booking.findMany.mockResolvedValue(conflicts);
    ctx.mockPrisma.booking.update.mockResolvedValue({});
    ctx.mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 });
  }

  it('should create a new booking with updated date and time', async () => {
    setupReschedulePath();
    ctx.mockPrisma.booking.create.mockResolvedValue({
      ...mockBooking,
      id: 'new-booking-id',
      date: new Date('2026-06-03'),
      startTime: '10:00',
      endTime: '10:30',
    });

    const result = await ctx.service.reschedule(mockBooking.id, {
      date: '2026-06-03',
      startTime: '10:00',
    });

    expect(result.startTime).toBe('10:00');
    expect(ctx.mockPrisma.booking.create).toHaveBeenCalled();
  });

  it('should recalculate endTime when startTime changes', async () => {
    setupReschedulePath();
    ctx.mockPrisma.booking.create.mockResolvedValue({
      ...mockBooking,
      id: 'new-booking-id',
      startTime: '15:00',
      endTime: '15:30',
    });

    const result = await ctx.service.reschedule(mockBooking.id, { startTime: '15:00' });

    expect(result.startTime).toBe('15:00');
    expect(result.endTime).toBe('15:30');
  });

  it('should throw ConflictException if new time conflicts', async () => {
    setupReschedulePath([
      { ...mockBooking, id: 'other-booking', startTime: '10:00', endTime: '10:30' },
    ]);

    await expect(
      ctx.service.reschedule(mockBooking.id, { date: '2026-06-01', startTime: '10:00' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if booking not found', async () => {
    ctx.mockPrisma.booking.findFirst.mockResolvedValue(null);

    await expect(
      ctx.service.reschedule('non-existent-id', { date: '2026-06-03' }),
    ).rejects.toThrow(NotFoundException);
  });
});
