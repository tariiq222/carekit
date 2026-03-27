import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
import { BookingCancellationService } from './booking-cancellation.service.js';
import { BookingQueryService } from './booking-query.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { BookingStatusService } from './booking-status.service.js';
import { BookingRescheduleService } from './booking-reschedule.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingCreationService } from './booking-creation.service.js';
import { ERR } from '../../common/constants/error-messages.js';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creationService: BookingCreationService,
    private readonly cancellationService: BookingCancellationService,
    private readonly queryService: BookingQueryService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly statusService: BookingStatusService,
    private readonly rescheduleService: BookingRescheduleService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  create(callerUserId: string, dto: CreateBookingDto, callerRoles?: Array<{ slug: string }>) {
    return this.creationService.execute(callerUserId, dto, callerRoles);
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
  getPaymentStatus(bookingId: string, userId: string) { return this.queryService.getPaymentStatus(bookingId, userId); }

  async reschedule(id: string, dto: RescheduleBookingDto, adminUserId?: string) {
    if (!dto.date && !dto.startTime) {
      throw new BadRequestException({ statusCode: 400, message: ERR.booking.invalidRescheduleInput, error: 'VALIDATION_ERROR' });
    }
    return this.rescheduleService.reschedule(id, dto, adminUserId);
  }

  async patientReschedule(bookingId: string, patientId: string, dto: RescheduleBookingDto) {
    const settings = await this.bookingSettingsService.get();
    if (!settings.patientCanReschedule) throw new BadRequestException({ statusCode: 400, message: ERR.booking.rescheduleNotAllowed, error: 'RESCHEDULE_NOT_ALLOWED' });
    const booking = await this.ensureBookingExists(bookingId);
    if (booking.patientId !== patientId) throw new ForbiddenException({ statusCode: 403, message: ERR.booking.rescheduleOwnership, error: 'FORBIDDEN' });
    const reschedulableStatuses = ['pending', 'confirmed', 'checked_in'];
    if (!reschedulableStatuses.includes(booking.status)) {
      throw new BadRequestException({ statusCode: 400, message: ERR.booking.invalidStatusForReschedule(booking.status), error: 'INVALID_STATUS_FOR_RESCHEDULE' });
    }
    if (booking.rescheduleCount >= settings.maxReschedulesPerBooking) throw new BadRequestException({ statusCode: 400, message: ERR.booking.rescheduleLimitReached(settings.maxReschedulesPerBooking), error: 'RESCHEDULE_LIMIT_REACHED' });
    const bdt = new Date(booking.date);
    const [h, m] = booking.startTime.split(':').map(Number);
    bdt.setHours(h, m, 0, 0);
    if ((bdt.getTime() - Date.now()) / (1000 * 60 * 60) < settings.rescheduleBeforeHours) throw new BadRequestException({ statusCode: 400, message: ERR.booking.rescheduleTooLate(settings.rescheduleBeforeHours), error: 'RESCHEDULE_TOO_LATE' });
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

  private async ensureBookingExists(id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, deletedAt: null } });
    if (!booking) throw new NotFoundException({ statusCode: 404, message: ERR.booking.notFound, error: 'NOT_FOUND' });
    return booking;
  }
}
