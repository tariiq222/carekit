import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Booking, BookingSettings } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { CancelApproveDto } from './dto/cancel-approve.dto.js';
import { CancelRejectDto } from './dto/cancel-reject.dto.js';
import { AdminCancelDto } from './dto/admin-cancel.dto.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { BookingCancelHelpersService } from './booking-cancel-helpers.service.js';
import { BookingLookupHelper, ADMIN_CANCELLABLE_STATUSES } from './booking-lookup.helper.js';
import { WaitlistService } from './waitlist.service.js';
import { bookingInclude } from './booking.constants.js';
import { NOTIF } from '../../common/constants/notification-messages.js';

@Injectable()
export class BookingCancellationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly helpers: BookingCancelHelpersService,
    private readonly lookup: BookingLookupHelper,
    private readonly waitlistService: WaitlistService,
  ) {}

  // ───────────────────────────────────────────────────────────────
  //  Fix 1 + Fix 12: Patient requests cancellation
  // ───────────────────────────────────────────────────────────────

  async requestCancellation(id: string, patientId: string, reason?: string) {
    const booking = await this.lookup.findBookingOrFail(id);

    this.lookup.assertPatientOwnership(booking, patientId);

    const PATIENT_CANCELLABLE_STATUSES = ['pending', 'confirmed', 'checked_in'];
    if (!PATIENT_CANCELLABLE_STATUSES.includes(booking.status)) {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot request cancellation for booking with status '${booking.status}' — allowed: ${PATIENT_CANCELLABLE_STATUSES.join(', ')}`,
        error: 'INVALID_STATUS_FOR_CANCELLATION',
      });
    }

    const settings = await this.bookingSettingsService.get();

    if (booking.status === 'pending') {
      return this.handlePendingCancel(booking, settings, reason);
    }

    if (booking.status === 'confirmed' || booking.status === 'checked_in') {
      return this.handleConfirmedCancelRequest(booking, settings, reason);
    }

    throw new ConflictException({
      statusCode: 409,
      message: `Cannot request cancellation for booking with status '${booking.status}'`,
      error: 'CONFLICT',
    });
  }

  // ───────────────────────────────────────────────────────────────
  //  Fix 8: Admin direct cancel — any non-terminal status
  // ───────────────────────────────────────────────────────────────

  async adminDirectCancel(bookingId: string, adminUserId: string, dto: AdminCancelDto) {
    const booking = await this.lookup.findWithPayment(bookingId);
    if (!ADMIN_CANCELLABLE_STATUSES.includes(booking.status)) {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot cancel booking with status '${booking.status}' — allowed: ${ADMIN_CANCELLABLE_STATUSES.join(', ')}`,
        error: 'INVALID_STATUS_FOR_ADMIN_CANCEL',
      });
    }
    this.lookup.assertCancellable(booking);
    this.helpers.validatePartialRefund(dto, booking.payment);

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'cancelled',
          cancelledBy: 'admin',
          cancelledAt: new Date(),
          cancellationReason: dto.reason,
          adminNotes: dto.adminNotes,
        },
        include: bookingInclude,
      });
      await this.helpers.processRefund(tx, dto.refundType, booking.payment, dto.refundAmount);
      return result;
    });

    await this.helpers.notifyPatientCancelled(cancelled, 'admin');
    await this.helpers.notifyPractitionerCancelled(cancelled);
    this.activityLogService.log({
      userId: adminUserId,
      action: 'admin_direct_cancel',
      module: 'bookings',
      resourceId: bookingId,
      description: `Admin cancelled booking. Refund: ${dto.refundType}`,
    }).catch(() => {});

    this.helpers.deleteZoomIfNeeded(booking);
    await this.waitlistService.checkAndNotify(booking.practitionerId, booking.date);
    return cancelled;
  }

  // ───────────────────────────────────────────────────────────────
  //  Fix 13: Practitioner cancels own booking
  // ───────────────────────────────────────────────────────────────

  async practitionerCancel(bookingId: string, practitionerUserId: string, reason?: string) {
    const booking = await this.lookup.findWithRelations(bookingId);

    this.lookup.assertPractitionerOwnership(booking, practitionerUserId);
    this.lookup.assertCancellable(booking);

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'cancelled',
          cancelledBy: 'practitioner',
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        include: bookingInclude,
      });
      // Always full refund — clinic's fault
      await this.helpers.processRefund(tx, 'full', booking.payment);
      return result;
    });

    await this.helpers.notifyPatientPractitionerCancelled(cancelled);
    const d = cancelled.date.toISOString().split('T')[0];
    await this.helpers.notifyAdmins(
      NOTIF.PRACTITIONER_CANCELLED_BOOKING.titleAr, NOTIF.PRACTITIONER_CANCELLED_BOOKING.titleEn,
      `قام طبيب بإلغاء موعد بتاريخ ${d}`, `A practitioner cancelled a booking on ${d}`,
      'booking_practitioner_cancelled', { bookingId },
    );
    this.activityLogService.log({
      userId: practitionerUserId,
      action: 'practitioner_cancel',
      module: 'bookings',
      resourceId: bookingId,
      description: 'Practitioner cancelled booking. Full refund applied',
    }).catch(() => {});

    this.helpers.deleteZoomIfNeeded(booking);
    await this.waitlistService.checkAndNotify(booking.practitionerId, booking.date);
    return cancelled;
  }

  // ───────────────────────────────────────────────────────────────
  //  Approve / Reject — existing flow
  // ───────────────────────────────────────────────────────────────

  async approveCancellation(id: string, dto: CancelApproveDto) {
    const booking = await this.lookup.findWithPayment(id);

    if (booking.status !== 'pending_cancellation') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot approve cancellation for booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }

    this.helpers.validatePartialRefund(dto, booking.payment);

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id },
        data: { status: 'cancelled', cancelledBy: 'patient', cancelledAt: new Date(), adminNotes: dto.adminNotes },
        include: bookingInclude,
      });
      await this.helpers.processRefund(tx, dto.refundType, booking.payment, dto.refundAmount);
      return result;
    });

    this.activityLogService.log({
      action: 'cancel_approved',
      module: 'bookings',
      resourceId: id,
      description: `Booking cancellation approved. Refund type: ${dto.refundType}`,
    }).catch(() => {});

    await this.helpers.notifyPatientCancelled(cancelled, 'approved');
    await this.helpers.notifyPractitionerCancelled(cancelled);
    this.helpers.deleteZoomIfNeeded(booking);
    await this.waitlistService.checkAndNotify(booking.practitionerId, booking.date);
    return cancelled;
  }

  async rejectCancellation(id: string, dto: CancelRejectDto) {
    const booking = await this.lookup.findBookingOrFail(id);

    if (booking.status !== 'pending_cancellation') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot reject cancellation for booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: 'confirmed', cancellationReason: null, adminNotes: dto.adminNotes },
      include: bookingInclude,
    });

    this.activityLogService.log({
      action: 'cancel_rejected',
      module: 'bookings',
      resourceId: id,
      description: 'Booking cancellation request rejected',
    }).catch(() => {});

    // Fix 4: Notify patient that cancellation was rejected
    if (updated.patientId) {
      await this.helpers.notifyPatientCancellationRejected(updated.patientId, id);
    }

    return updated;
  }

  // ───────────────────────────────────────────────────────────────
  //  Private: pending & confirmed cancel flows
  // ───────────────────────────────────────────────────────────────

  private async handlePendingCancel(booking: Booking, settings: BookingSettings, reason?: string) {
    if (!settings.patientCanCancelPending) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Cannot cancel pending booking',
        error: 'CONFLICT',
      });
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'cancelled',
          cancelledBy: 'patient',
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        include: bookingInclude,
      });
      await tx.payment.deleteMany({
        where: { bookingId: booking.id, status: { in: ['awaiting', 'pending'] } },
      });
      return result;
    });

    await this.helpers.notifyPatientCancelled(cancelled, 'approved');
    await this.helpers.notifyPractitionerCancelled(cancelled);
    this.helpers.deleteZoomIfNeeded(booking);
    await this.waitlistService.checkAndNotify(booking.practitionerId, booking.date);

    this.activityLogService.log({
      action: 'booking_cancellation_requested',
      module: 'bookings',
      resourceId: booking.id,
      description: 'Patient cancelled pending booking directly',
    }).catch(() => {});

    return cancelled;
  }

  private async handleConfirmedCancelRequest(
    booking: Booking, settings: BookingSettings, reason?: string,
  ) {
    const suggestedRefundType = this.helpers.calculateSuggestedRefund(booking, settings);

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'pending_cancellation', cancellationReason: reason, suggestedRefundType },
      include: bookingInclude,
    });

    const d = booking.date.toISOString().split('T')[0];
    await this.helpers.notifyAdmins(
      NOTIF.CANCELLATION_REQUEST_NEW.titleAr, NOTIF.CANCELLATION_REQUEST_NEW.titleEn,
      `طلب مريض إلغاء الموعد بتاريخ ${d}`, `A patient requested cancellation for booking on ${d}`,
      'booking_cancellation_requested', { bookingId: booking.id },
    );

    this.activityLogService.log({
      action: 'booking_cancellation_requested',
      module: 'bookings',
      resourceId: booking.id,
      description: `Patient requested cancellation for booking on ${d}`,
    }).catch(() => {});

    return updated;
  }

}
