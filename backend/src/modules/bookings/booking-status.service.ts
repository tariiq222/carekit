import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CompleteBookingDto } from './dto/complete-booking.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingStatusLogService } from './booking-status-log.service.js';
import { bookingInclude } from './booking.constants.js';
import { NOTIF } from '../../common/constants/notification-messages.js';

@Injectable()
export class BookingStatusService {
  private readonly logger = new Logger(BookingStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly statusLogService: BookingStatusLogService,
  ) {}

  async confirm(id: string, performedByUserId?: string) {
    const confirmed = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id, deletedAt: null } });
      if (!booking) {
        throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
      }
      if (booking.status !== 'pending') {
        throw new ConflictException({
          statusCode: 409,
          message: `Cannot confirm booking with status '${booking.status}'`,
          error: 'CONFLICT',
        });
      }
      const payment = await tx.payment.findFirst({ where: { bookingId: id } });
      if (!payment || payment.status !== 'paid') {
        throw new ConflictException({
          statusCode: 409,
          message: 'Payment is required before confirming a booking',
          error: 'PAYMENT_REQUIRED',
        });
      }
      return tx.booking.update({
        where: { id },
        data: { status: 'confirmed', confirmedAt: new Date() },
        include: bookingInclude,
      });
    }, { isolationLevel: 'Serializable', timeout: 10000 });

    if (confirmed.patientId) {
      const d = confirmed.date.toISOString().split('T')[0];
      await this.notificationsService.createNotification({
        userId: confirmed.patientId, type: 'booking_confirmed',
        ...NOTIF.BOOKING_CONFIRMED,
        bodyAr: `تم تأكيد موعدك بتاريخ ${d} الساعة ${confirmed.startTime}`,
        bodyEn: `Your booking on ${d} at ${confirmed.startTime} has been confirmed`,
        data: { bookingId: id },
      });
    }

    this.activityLogService.log({
      action: 'booking_confirmed',
      module: 'bookings',
      resourceId: id,
      userId: performedByUserId,
      description: `Booking confirmed for ${confirmed.date.toISOString().split('T')[0]} at ${confirmed.startTime}`,
    }).catch((err) => this.logger.warn('Activity log failed', { error: err?.message }));

    this.statusLogService.log({
      bookingId: id,
      fromStatus: 'pending',
      toStatus: 'confirmed',
      changedBy: performedByUserId,
    }).catch((err) => this.logger.warn('Status log failed', { error: err?.message }));

    return confirmed;
  }

  async checkIn(id: string, performedByUserId?: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id, deletedAt: null } });
      if (!booking) {
        throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
      }
      if (booking.status !== 'confirmed') {
        throw new ConflictException({
          statusCode: 409,
          message: `Cannot check in booking with status '${booking.status}'`,
          error: 'CONFLICT',
        });
      }
      return tx.booking.update({
        where: { id },
        data: { status: 'checked_in', checkedInAt: new Date() },
        include: bookingInclude,
      });
    }, { isolationLevel: 'Serializable', timeout: 10000 });

    const practitioner = await this.prisma.practitioner.findUnique({
      where: { id: updated.practitionerId },
    });
    if (practitioner?.userId) {
      await this.notificationsService.createNotification({
        userId: practitioner.userId, type: 'patient_arrived',
        ...NOTIF.PATIENT_ARRIVED,
        data: { bookingId: id },
      });
    }

    this.activityLogService.log({
      action: 'booking_checked_in',
      module: 'bookings',
      resourceId: id,
      userId: performedByUserId,
      description: 'Patient checked in for booking',
    }).catch((err) => this.logger.warn('Activity log failed', { error: err?.message }));

    this.statusLogService.log({
      bookingId: id,
      fromStatus: 'confirmed',
      toStatus: 'checked_in',
      changedBy: performedByUserId,
    }).catch((err) => this.logger.warn('Status log failed', { error: err?.message }));

    return updated;
  }

  async startSession(id: string, practitionerUserId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id, deletedAt: null } });
      if (!booking) {
        throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
      }
      if (booking.status !== 'checked_in') {
        if (booking.status === 'confirmed') {
          throw new BadRequestException({
            statusCode: 400,
            message: 'يجب تسجيل وصول المريض أولاً — استخدم checkIn قبل startSession',
            error: 'CHECKIN_REQUIRED',
          });
        }
        throw new ConflictException({
          statusCode: 409,
          message: `Cannot start session for booking with status '${booking.status}'`,
          error: 'CONFLICT',
        });
      }
      const practitioner = await tx.practitioner.findFirst({
        where: { userId: practitionerUserId },
      });
      if (!practitioner || practitioner.id !== booking.practitionerId) {
        throw new ForbiddenException({
          statusCode: 403,
          message: 'You can only start sessions for your own bookings',
          error: 'FORBIDDEN',
        });
      }
      return tx.booking.update({
        where: { id },
        data: { status: 'in_progress', inProgressAt: new Date() },
        include: bookingInclude,
      });
    }, { isolationLevel: 'Serializable', timeout: 10000 });

    this.activityLogService.log({
      action: 'booking_started',
      module: 'bookings',
      resourceId: id,
      userId: practitionerUserId,
      description: 'Practitioner started session',
    }).catch((err) => this.logger.warn('Activity log failed', { error: err?.message }));

    this.statusLogService.log({
      bookingId: id,
      fromStatus: 'checked_in',
      toStatus: 'in_progress',
      changedBy: practitionerUserId,
    }).catch((err) => this.logger.warn('Status log failed', { error: err?.message }));

    return updated;
  }

  async complete(id: string, dto?: CompleteBookingDto, performedByUserId?: string) {
    const completed = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id, deletedAt: null } });
      if (!booking) {
        throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
      }
      if (booking.status !== 'in_progress') {
        if (booking.status === 'checked_in') {
          throw new BadRequestException({
            statusCode: 400,
            message: 'يجب بدء الجلسة أولاً قبل إتمام الحجز — استخدم startSession أولاً',
            error: 'SESSION_NOT_STARTED',
          });
        }
        if (booking.status === 'confirmed') {
          throw new BadRequestException({
            statusCode: 400,
            message: 'يجب تسجيل وصول المريض وبدء الجلسة أولاً قبل إتمام الحجز',
            error: 'CHECKIN_AND_SESSION_REQUIRED',
          });
        }
        throw new ConflictException({
          statusCode: 409,
          message: `Cannot complete booking with status '${booking.status}'`,
          error: 'CONFLICT',
        });
      }
      return tx.booking.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date(), completionNotes: dto?.completionNotes },
        include: bookingInclude,
      });
    }, { isolationLevel: 'Serializable', timeout: 10000 });

    if (completed.patientId) {
      await this.notificationsService.createNotification({
        userId: completed.patientId, type: 'booking_completed',
        ...NOTIF.BOOKING_COMPLETED,
        data: { bookingId: id },
      });
    }

    this.activityLogService.log({
      action: 'booking_completed',
      module: 'bookings',
      resourceId: id,
      userId: performedByUserId,
      description: 'Booking completed',
    }).catch((err) => this.logger.warn('Activity log failed', { error: err?.message }));

    this.statusLogService.log({
      bookingId: id,
      fromStatus: 'in_progress',
      toStatus: 'completed',
      changedBy: performedByUserId,
    }).catch((err) => this.logger.warn('Status log failed', { error: err?.message }));

    return completed;
  }

  /**
   * Recover an expired booking back to confirmed.
   * Used when a payment succeeds after the booking was expired by the cron job.
   * updateMany with status condition makes this idempotent under concurrent retries.
   */
  async recoverExpiredBooking(bookingId: string): Promise<boolean> {
    const result = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: 'expired' },
      data: { status: 'confirmed', confirmedAt: new Date(), cancelledBy: null, cancelledAt: null },
    });
    return result.count > 0;
  }

  async markNoShow(id: string, performedByUserId?: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id, deletedAt: null } });
      if (!booking) {
        throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
      }
      if (booking.status !== 'confirmed') {
        throw new ConflictException({
          statusCode: 409,
          message: `Cannot mark no-show for booking with status '${booking.status}' — only 'confirmed' bookings can be marked as no-show`,
          error: 'INVALID_STATUS_FOR_NO_SHOW',
        });
      }
      return tx.booking.update({
        where: { id },
        data: { status: 'no_show' },
        include: bookingInclude,
      });
    }, { isolationLevel: 'Serializable', timeout: 10000 });

    this.activityLogService.log({
      action: 'booking_no_show',
      module: 'bookings',
      resourceId: id,
      userId: performedByUserId,
      description: 'Booking marked as no-show',
    }).catch((err) => this.logger.warn('Activity log failed', { error: err?.message }));

    this.statusLogService.log({
      bookingId: id,
      fromStatus: 'confirmed',
      toStatus: 'no_show',
      changedBy: performedByUserId,
    }).catch((err) => this.logger.warn('Status log failed', { error: err?.message }));

    return updated;
  }
}
