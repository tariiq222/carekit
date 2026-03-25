import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { BookingListQueryDto } from './dto/booking-list-query.dto.js';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto.js';
import { CancelApproveDto } from './dto/cancel-approve.dto.js';
import { CancelRejectDto } from './dto/cancel-reject.dto.js';
import { AdminCancelDto } from './dto/admin-cancel.dto.js';
import { CompleteBookingDto } from './dto/complete-booking.dto.js';
import { ZoomService } from '../integrations/zoom/zoom.service.js';
import { BookingCancellationService } from './booking-cancellation.service.js';
import { BookingQueryService } from './booking-query.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { BookingStatusService } from './booking-status.service.js';
import { BookingRescheduleService } from './booking-reschedule.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { validateAvailability, checkDoubleBooking, validateClinicAvailability } from './booking-validation.helper.js';
import { calculateEndTime, validateNoCrossMidnight } from '../../common/helpers/booking-time.helper.js';
import { bookingInclude } from './booking.constants.js';
import { BookingPaymentHelper } from './booking-payment.helper.js';
import { PriceResolverService } from './price-resolver.service.js';
import { ClinicHoursService } from '../clinic/clinic-hours.service.js';
import { ClinicHolidaysService } from '../clinic/clinic-holidays.service.js';
import { CLINIC_TIMEZONE } from '../../config/constants/index.js';
import { NOTIF } from '../../common/constants/notification-messages.js';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomService: ZoomService,
    private readonly cancellationService: BookingCancellationService,
    private readonly queryService: BookingQueryService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly statusService: BookingStatusService,
    private readonly rescheduleService: BookingRescheduleService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly paymentHelper: BookingPaymentHelper,
    private readonly priceResolver: PriceResolverService,
    private readonly clinicHoursService: ClinicHoursService,
    private readonly clinicHolidaysService: ClinicHolidaysService,
  ) {}

  async create(callerUserId: string, dto: CreateBookingDto) {
    // Fix 7: Admin book on behalf — resolve actual patient
    const actualPatientId = await this.paymentHelper.resolvePatientId(callerUserId, dto.patientId);

    // Fetch settings once (used for walk-in, lead time, and conflict suggestions)
    const settings = await this.bookingSettingsService.get();

    // Fix 9: Walk-in validation
    if (dto.type === 'walk_in') {
      if (!settings.allowWalkIn) {
        throw new BadRequestException({ statusCode: 400, message: 'Walk-in bookings are not allowed', error: 'WALK_IN_NOT_ALLOWED' });
      }
    }

    const practitioner = await this.prisma.practitioner.findFirst({ where: { id: dto.practitionerId, isActive: true, deletedAt: null } });
    if (!practitioner) throw new NotFoundException({ statusCode: 404, message: 'Practitioner not found', error: 'NOT_FOUND' });
    if (!practitioner.isAcceptingBookings) {
      throw new BadRequestException({ statusCode: 400, message: 'Practitioner is not accepting new bookings at this time', error: 'NOT_ACCEPTING_BOOKINGS' });
    }

    const service = await this.prisma.service.findFirst({ where: { id: dto.serviceId, isActive: true, deletedAt: null } });
    if (!service) throw new NotFoundException({ statusCode: 404, message: 'Service not found', error: 'NOT_FOUND' });

    const ps = await this.prisma.practitionerService.findUnique({
      where: { practitionerId_serviceId: { practitionerId: dto.practitionerId, serviceId: dto.serviceId } },
    });
    if (!ps) throw new BadRequestException({ statusCode: 400, message: 'Practitioner does not offer this service', error: 'SERVICE_NOT_OFFERED' });
    if (!ps.isActive) throw new BadRequestException({ statusCode: 400, message: 'This service is currently unavailable for this practitioner', error: 'SERVICE_INACTIVE' });
    if (!ps.availableTypes.includes(dto.type)) throw new BadRequestException({ statusCode: 400, message: `Booking type '${dto.type}' is not available for this service`, error: 'TYPE_NOT_AVAILABLE' });

    // Resolve price and duration via the new pricing model (ServiceBookingType + PractitionerServiceType)
    // Falls back gracefully if the new models have no data yet
    const resolved = await this.resolvePriceOrFallback(dto, ps, service);
    const duration = resolved.duration;

    const bookingDate = new Date(dto.date);
    const nowRiyadh = new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TIMEZONE }).format(new Date());
    const today = new Date(nowRiyadh); // midnight in Riyadh
    if (bookingDate < today) throw new BadRequestException({ statusCode: 400, message: 'Cannot book in the past', error: 'VALIDATION_ERROR' });

    // Max advance booking window check
    if (settings.maxAdvanceBookingDays > 0) {
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + settings.maxAdvanceBookingDays);
      if (bookingDate > maxDate) {
        throw new BadRequestException({
          statusCode: 400,
          message: `Bookings cannot be made more than ${settings.maxAdvanceBookingDays} days in advance`,
          error: 'BOOKING_TOO_FAR_IN_ADVANCE',
        });
      }
    }

    // Lead time check
    if (settings.minBookingLeadMinutes > 0) {
      const bookingDateTime = new Date(bookingDate);
      const [leadH, leadM] = dto.startTime.split(':').map(Number);
      bookingDateTime.setHours(leadH, leadM, 0, 0);
      const minutesUntil = (bookingDateTime.getTime() - Date.now()) / (1000 * 60);
      if (minutesUntil < settings.minBookingLeadMinutes) {
        throw new BadRequestException({
          statusCode: 400,
          message: `Booking must be at least ${settings.minBookingLeadMinutes} minutes in advance`,
          error: 'BOOKING_LEAD_TIME_VIOLATION',
        });
      }
    }
    const endTime = calculateEndTime(dto.startTime, duration);
    validateNoCrossMidnight(dto.startTime, duration);

    // Admin override: skip clinic & practitioner availability checks
    const skipChecks = callerUserId !== actualPatientId && settings.adminCanBookOutsideHours;
    if (!skipChecks) {
      const [clinicHours, holidays] = await Promise.all([
        this.clinicHoursService.getAll(),
        this.clinicHolidaysService.findAll(),
      ]);
      validateClinicAvailability(clinicHours, holidays, bookingDate, dto.startTime, endTime);
    }

    // Zoom must be created before the transaction (external API call)
    let zoomData: { zoomMeetingId?: string; zoomJoinUrl?: string; zoomHostUrl?: string } = {};
    if (dto.type === 'video_consultation') {
      const isoStart = `${dto.date}T${dto.startTime}:00`;
      const meeting = await this.zoomService.createMeeting('CareKit Video Consultation', isoStart, duration);
      zoomData = { zoomMeetingId: meeting.meetingId, zoomJoinUrl: meeting.joinUrl, zoomHostUrl: meeting.hostUrl };
    }

    // Serializable transaction: availability check + double-booking check + create
    // This prevents race conditions where two concurrent requests both pass the
    // conflict check and create bookings for the same slot.
    const isWalkIn = dto.type === 'walk_in';
    // TODO: enforce that only admin/staff roles can set payAtClinic === true
    const isPayAtClinic = dto.payAtClinic === true;
    let booking;
    try {
    booking = await this.prisma.$transaction(async (tx) => {
      if (!skipChecks) {
        await validateAvailability(tx, dto.practitionerId, bookingDate, dto.startTime, endTime);
      }
      try {
        // Override chain: PractitionerService > Service > BookingSettings (global)
        const bufferMinutes = ps.bufferMinutes || service.bufferMinutes || settings.bufferMinutes;
        await checkDoubleBooking(tx, dto.practitionerId, bookingDate, dto.startTime, endTime, undefined, bufferMinutes);
      } catch (err) {
        if (err instanceof ConflictException) {
          if (settings.suggestAlternativesOnConflict) {
            const alternatives = await this.queryService.getNextAvailableSlots(
              dto.practitionerId, bookingDate, settings.suggestAlternativesCount,
            );
            throw new ConflictException({
              statusCode: 409, message: 'Practitioner already has a booking at this time',
              error: 'BOOKING_CONFLICT', alternatives,
            });
          }
        }
        throw err;
      }

      return tx.booking.create({
        data: {
          patientId: actualPatientId,
          practitionerId: dto.practitionerId,
          serviceId: dto.serviceId,
          practitionerServiceId: ps.id,
          type: dto.type,
          date: bookingDate,
          startTime: dto.startTime,
          endTime,
          status: isWalkIn || isPayAtClinic ? 'confirmed' : 'pending',
          confirmedAt: isWalkIn || isPayAtClinic ? new Date() : undefined,
          isWalkIn,
          notes: dto.notes,
          bookedPrice: resolved.price,
          bookedDuration: resolved.duration,
          durationOptionId: resolved.durationOptionId ?? null,
          recurringGroupId: dto.recurringGroupId ?? null,
          ...zoomData,
        },
        include: bookingInclude,
      });
    }, { isolationLevel: 'Serializable', timeout: 10000 });
    } catch (err) {
      // Clean up Zoom meeting if transaction failed after external API call
      if (zoomData.zoomMeetingId) {
        this.zoomService.deleteMeeting(zoomData.zoomMeetingId).catch((e) =>
          this.logger.warn(`Failed to delete Zoom meeting after booking transaction failure: ${e.message}`),
        );
      }
      throw err;
    }

    // H5: Payment creation is critical — if it fails, cancel the booking to avoid
    // orphaned bookings stuck in 'pending' with no payment record.
    try {
      await this.paymentHelper.createPaymentIfNeeded(booking.id, dto.type, resolved.price, isPayAtClinic);
    } catch (paymentErr) {
      this.logger.error(
        `Payment creation failed for booking ${booking.id} — cancelling booking to prevent orphan`,
        paymentErr,
      );
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'cancelled', cancelledAt: new Date(), adminNotes: 'Auto-cancelled: payment record creation failed' },
      });
      throw paymentErr;
    }

    if (practitioner.userId) {
      const d = bookingDate.toISOString().split('T')[0];
      await this.notificationsService.createNotification({
        userId: practitioner.userId, type: 'booking_confirmed',
        ...NOTIF.BOOKING_NEW_FOR_PRACTITIONER,
        bodyAr: `لديك حجز جديد بتاريخ ${d} الساعة ${dto.startTime}`,
        bodyEn: `You have a new booking on ${d} at ${dto.startTime}`,
        data: { bookingId: booking.id },
      });
    }

    this.activityLogService.log({
      action: 'booking_created',
      module: 'bookings',
      resourceId: booking.id,
      description: `Booking created for ${dto.date} at ${dto.startTime}`,
    }).catch(() => {});

    return booking;
  }

  // --- Delegated: Queries ---
  findAll(query: BookingListQueryDto) { return this.queryService.findAll(query); }
  findOne(id: string) { return this.queryService.findOne(id); }
  findAllScoped(query: BookingListQueryDto, userId: string) { return this.queryService.findAllScoped(query, userId); }
  findOneScoped(bookingId: string, userId: string) { return this.queryService.findOneScoped(bookingId, userId); }
  findMyBookings(patientId: string) { return this.queryService.findMyBookings(patientId); }
  findTodayBookingsForUser(userId: string) { return this.queryService.findTodayBookingsForUser(userId); }
  findTodayBookings(userId: string) { return this.queryService.findTodayBookings(userId); }
  getStats() { return this.queryService.getStats(); }

  async reschedule(id: string, dto: RescheduleBookingDto, adminUserId?: string) {
    if (!dto.date && !dto.startTime) {
      throw new BadRequestException({ statusCode: 400, message: 'At least one of date or startTime must be provided', error: 'VALIDATION_ERROR' });
    }
    return this.rescheduleService.reschedule(id, dto, adminUserId);
  }

  async patientReschedule(bookingId: string, patientId: string, dto: RescheduleBookingDto) {
    const settings = await this.bookingSettingsService.get();
    if (!settings.patientCanReschedule) throw new BadRequestException({ statusCode: 400, message: 'Patient self-reschedule is not enabled', error: 'RESCHEDULE_NOT_ALLOWED' });
    const booking = await this.ensureBookingExists(bookingId);
    if (booking.patientId !== patientId) throw new ForbiddenException({ statusCode: 403, message: 'You can only reschedule your own bookings', error: 'FORBIDDEN' });
    const reschedulableStatuses = ['pending', 'confirmed', 'checked_in'];
    if (!reschedulableStatuses.includes(booking.status)) {
      throw new BadRequestException({ statusCode: 400, message: `Cannot reschedule a booking with status '${booking.status}'`, error: 'INVALID_STATUS_FOR_RESCHEDULE' });
    }
    if (booking.rescheduleCount >= settings.maxReschedulesPerBooking) throw new BadRequestException({ statusCode: 400, message: `Maximum reschedule limit (${settings.maxReschedulesPerBooking}) reached`, error: 'RESCHEDULE_LIMIT_REACHED' });
    const bdt = new Date(booking.date);
    const [h, m] = booking.startTime.split(':').map(Number);
    bdt.setHours(h, m, 0, 0);
    if ((bdt.getTime() - Date.now()) / (1000 * 60 * 60) < settings.rescheduleBeforeHours) throw new BadRequestException({ statusCode: 400, message: `Must reschedule at least ${settings.rescheduleBeforeHours} hours before the appointment`, error: 'RESCHEDULE_TOO_LATE' });
    const result = await this.reschedule(bookingId, dto);
    await this.prisma.booking.update({ where: { id: result.id }, data: { rescheduleCount: booking.rescheduleCount + 1 } });
    this.activityLogService.log({ action: 'booking_patient_rescheduled', module: 'bookings', resourceId: result.id, description: `Patient rescheduled booking (count: ${booking.rescheduleCount + 1})` }).catch(() => {});
    return { ...result, rescheduleCount: booking.rescheduleCount + 1 };
  }

  // --- Delegated: Status Transitions ---
  confirm(id: string, userId?: string) { return this.statusService.confirm(id, userId); }
  checkIn(id: string, userId?: string) { return this.statusService.checkIn(id, userId); }
  startSession(id: string, userId: string) { return this.statusService.startSession(id, userId); }
  complete(id: string, dto?: CompleteBookingDto) { return this.statusService.complete(id, dto); }
  markNoShow(id: string) { return this.statusService.markNoShow(id); }

  // --- Delegated: Cancellation ---
  requestCancellation(id: string, patientId: string, reason?: string) { return this.cancellationService.requestCancellation(id, patientId, reason); }
  approveCancellation(id: string, dto: CancelApproveDto) { return this.cancellationService.approveCancellation(id, dto); }
  rejectCancellation(id: string, dto: CancelRejectDto) { return this.cancellationService.rejectCancellation(id, dto); }
  adminDirectCancel(id: string, adminUserId: string, dto: AdminCancelDto) { return this.cancellationService.adminDirectCancel(id, adminUserId, dto); }
  practitionerCancel(id: string, userId: string, reason?: string) { return this.cancellationService.practitionerCancel(id, userId, reason); }

  // --- Private helpers ---

  /** Resolve price/duration from new pricing models, falling back to legacy fields if not configured */
  private async resolvePriceOrFallback(
    dto: CreateBookingDto,
    ps: { id: string; customDuration: number | null; priceClinic?: number | null; pricePhone?: number | null; priceVideo?: number | null },
    service: { id: string; price: number; duration: number },
  ): Promise<{ price: number; duration: number; source: string; durationOptionId?: string }> {
    try {
      return await this.priceResolver.resolve({
        serviceId: dto.serviceId,
        practitionerServiceId: ps.id,
        bookingType: dto.type,
        durationOptionId: dto.durationOptionId,
      });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const duration = ps.customDuration ?? service.duration;
      const priceField = dto.type === 'clinic_visit' || dto.type === 'walk_in' ? 'priceClinic' as const
        : dto.type === 'phone_consultation' ? 'pricePhone' as const : 'priceVideo' as const;
      const price = (ps as Record<string, unknown>)[priceField] as number ?? service.price ?? 0;
      return { price, duration, source: 'legacy_fallback' };
    }
  }

  private async ensureBookingExists(id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, deletedAt: null } });
    if (!booking) throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    return booking;
  }
}
