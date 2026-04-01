import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { ZoomService } from '../integrations/zoom/zoom.service.js';
import { BookingQueryService } from './booking-query.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
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
import { ERR } from '../../common/constants/error-messages.js';

@Injectable()
export class BookingCreationService {
  private readonly logger = new Logger(BookingCreationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomService: ZoomService,
    private readonly queryService: BookingQueryService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly paymentHelper: BookingPaymentHelper,
    private readonly priceResolver: PriceResolverService,
    private readonly clinicHoursService: ClinicHoursService,
    private readonly clinicHolidaysService: ClinicHolidaysService,
  ) {}

  async execute(
    callerUserId: string,
    dto: CreateBookingDto,
    callerRoles?: Array<{ slug: string }>,
  ) {
    const actualPatientId = await this.paymentHelper.resolvePatientId(callerUserId, dto.patientId, callerRoles);

    const practitioner = await this.prisma.practitioner.findFirst({ where: { id: dto.practitionerId, isActive: true, deletedAt: null } });
    if (!practitioner) throw new NotFoundException({ statusCode: 404, message: ERR.practitioner.notFound, error: 'NOT_FOUND' });
    if (!practitioner.isAcceptingBookings) {
      throw new BadRequestException({ statusCode: 400, message: ERR.practitioner.notAcceptingBookings, error: 'NOT_ACCEPTING_BOOKINGS' });
    }

    const service = await this.prisma.service.findFirst({ where: { id: dto.serviceId, isActive: true, deletedAt: null } });
    if (!service) throw new NotFoundException({ statusCode: 404, message: ERR.service.notFound, error: 'NOT_FOUND' });

    const ps = await this.prisma.practitionerService.findUnique({
      where: { practitionerId_serviceId: { practitionerId: dto.practitionerId, serviceId: dto.serviceId } },
    });
    if (!ps) throw new BadRequestException({ statusCode: 400, message: ERR.service.notOffered, error: 'SERVICE_NOT_OFFERED' });
    if (!ps.isActive) throw new BadRequestException({ statusCode: 400, message: ERR.service.inactive, error: 'SERVICE_INACTIVE' });
    if (!ps.availableTypes.includes(dto.type)) throw new BadRequestException({ statusCode: 400, message: ERR.service.typeNotAvailable(dto.type), error: 'TYPE_NOT_AVAILABLE' });

    // Validate service is available at the booking's branch
    const branchId = await this.resolveBranchContext(dto.practitionerId, dto.branchId);
    const serviceBranchCount = await this.prisma.serviceBranch.count({
      where: { serviceId: dto.serviceId },
    });
    if (serviceBranchCount > 0 && branchId) {
      const allowed = await this.prisma.serviceBranch.findUnique({
        where: { serviceId_branchId: { serviceId: dto.serviceId, branchId } },
        select: { id: true },
      });
      if (!allowed) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Service is not available at the selected branch',
          error: 'SERVICE_NOT_AVAILABLE_AT_BRANCH',
        });
      }
    }

    const settings = await this.bookingSettingsService.getForBranch(branchId);

    if (dto.type === 'walk_in' && !settings.allowWalkIn) {
      throw new BadRequestException({ statusCode: 400, message: ERR.booking.walkInNotAllowed, error: 'WALK_IN_NOT_ALLOWED' });
    }

    const resolved = await this.resolvePriceOrFallback(dto, ps, service);
    const duration = resolved.duration;

    const bookingDate = new Date(dto.date);
    const nowRiyadh = new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TIMEZONE }).format(new Date());
    const today = new Date(nowRiyadh);
    if (bookingDate < today) throw new BadRequestException({ statusCode: 400, message: ERR.booking.pastDate, error: 'VALIDATION_ERROR' });

    if (settings.maxAdvanceBookingDays > 0) {
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + settings.maxAdvanceBookingDays);
      if (bookingDate > maxDate) {
        throw new BadRequestException({
          statusCode: 400,
          message: ERR.booking.tooFarInAdvance(settings.maxAdvanceBookingDays),
          error: 'BOOKING_TOO_FAR_IN_ADVANCE',
        });
      }
    }

    if (settings.minBookingLeadMinutes > 0) {
      const bookingDateTime = new Date(bookingDate);
      const [leadH, leadM] = dto.startTime.split(':').map(Number);
      bookingDateTime.setHours(leadH, leadM, 0, 0);
      const minutesUntil = (bookingDateTime.getTime() - Date.now()) / (1000 * 60);
      if (minutesUntil < settings.minBookingLeadMinutes) {
        throw new BadRequestException({
          statusCode: 400,
          message: ERR.booking.leadTimeViolation(settings.minBookingLeadMinutes),
          error: 'BOOKING_LEAD_TIME_VIOLATION',
        });
      }
    }

    const endTime = calculateEndTime(dto.startTime, duration);
    validateNoCrossMidnight(dto.startTime, duration);

    const skipChecks = callerUserId !== actualPatientId && settings.adminCanBookOutsideHours;
    if (!skipChecks) {
      const [clinicHours, holidays] = await Promise.all([
        this.clinicHoursService.getAll(),
        this.clinicHolidaysService.findAll(),
      ]);
      validateClinicAvailability(clinicHours, holidays, bookingDate, dto.startTime, endTime);
    }

    let zoomData: { zoomMeetingId?: string; zoomJoinUrl?: string; zoomHostUrl?: string } = {};
    // Zoom is triggered for online bookings on-demand (at session time), not at booking creation.
    // zoomData remains empty here; a separate endpoint will create the meeting when needed.

    const isWalkIn = dto.type === 'walk_in';
    const isPayAtClinic = dto.payAtClinic === true;
    const MAX_RETRIES = 3;
    let booking;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        booking = await this.prisma.$transaction(async (tx) => {
          if (!skipChecks) {
            await validateAvailability(tx, dto.practitionerId, bookingDate, dto.startTime, endTime, branchId);
          }
          try {
            const bufferMinutes = ps.bufferMinutes || service.bufferMinutes || settings.bufferMinutes;
            await checkDoubleBooking(tx, dto.practitionerId, bookingDate, dto.startTime, endTime, undefined, bufferMinutes);
          } catch (err) {
            if (err instanceof ConflictException) {
              if (settings.suggestAlternativesOnConflict) {
                const alternatives = await this.queryService.getNextAvailableSlots(
                  dto.practitionerId, bookingDate, settings.suggestAlternativesCount, branchId,
                );
                throw new ConflictException({
                  statusCode: 409, message: ERR.booking.conflict,
                  error: 'BOOKING_CONFLICT', alternatives,
                });
              }
            }
            throw err;
          }

          return tx.booking.create({
            data: {
              patientId: actualPatientId,
              branchId,
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
        break; // success — exit retry loop
      } catch (err) {
        const isSerializationFailure =
          (err as { code?: string })?.code === 'P2034' ||
          String((err as { message?: string })?.message).includes('40001');

        if (isSerializationFailure && attempt < MAX_RETRIES) {
          this.logger.warn(`Booking creation serialization failure (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
          lastErr = err;
          continue;
        }

        if (zoomData.zoomMeetingId) {
          this.zoomService.deleteMeeting(zoomData.zoomMeetingId).catch((e) =>
            this.logger.warn(`Failed to delete Zoom meeting after booking transaction failure: ${e.message}`),
          );
        }
        throw err;
      }
    }

    if (!booking) {
      if (zoomData.zoomMeetingId) {
        this.zoomService.deleteMeeting(zoomData.zoomMeetingId).catch((e) =>
          this.logger.warn(`Failed to delete Zoom meeting after booking transaction failure: ${e.message}`),
        );
      }
      throw lastErr;
    }

    try {
      await this.paymentHelper.createPaymentIfNeeded(booking.id, dto.type, resolved.price, isPayAtClinic, callerRoles);
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
    }).catch((err) => this.logger.warn('Activity log failed', { error: err?.message }));

    // Resolve intake form info for the widget popup
    const intakeForm = await this.prisma.intakeForm.findFirst({
      where: { serviceId: dto.serviceId, isActive: true },
      select: { id: true },
    });

    let intakeFormAlreadySubmitted = false;
    if (intakeForm && actualPatientId) {
      const existing = await this.prisma.intakeResponse.findFirst({
        where: { formId: intakeForm.id, patientId: actualPatientId },
        select: { id: true },
      });
      intakeFormAlreadySubmitted = !!existing;
    }

    return {
      ...booking,
      intakeFormId: intakeForm?.id ?? null,
      intakeFormAlreadySubmitted,
    };
  }

  private async resolvePriceOrFallback(
    dto: CreateBookingDto,
    ps: { id: string; customDuration: number | null },
    service: { id: string; price: number; duration: number },
  ): Promise<{ price: number; duration: number; source: string; durationOptionId?: string }> {
    return await this.priceResolver.resolve({
      serviceId: dto.serviceId,
      practitionerServiceId: ps.id,
      bookingType: dto.type,
      durationOptionId: dto.durationOptionId,
    });
  }

  private async ensureBookingExists(id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, deletedAt: null } });
    if (!booking) throw new NotFoundException({ statusCode: 404, message: ERR.booking.notFound, error: 'NOT_FOUND' });
    return booking;
  }

  private async resolveBranchContext(practitionerId: string, branchId?: string): Promise<string | undefined> {
    if (!branchId) return undefined;

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException({ statusCode: 404, message: ERR.branch.notFound, error: 'NOT_FOUND' });
    }

    const assignment = await this.prisma.practitionerBranch.findUnique({
      where: { practitionerId_branchId: { practitionerId, branchId } },
      select: { id: true },
    });
    if (!assignment) {
      throw new BadRequestException({
        statusCode: 400,
        message: ERR.practitioner.branchMismatch,
        error: 'PRACTITIONER_BRANCH_MISMATCH',
      });
    }

    return branch.id;
  }
}
