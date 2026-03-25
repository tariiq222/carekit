import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CompleteBookingDto } from './dto/complete-booking.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingStatusLogService } from './booking-status-log.service.js';
import { bookingInclude } from './booking.constants.js';

@Injectable()
export class BookingStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly statusLogService: BookingStatusLogService,
  ) {}

  async confirm(id: string) {
    const booking = await this.ensureBookingExists(id);
    if (booking.status !== 'pending') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot confirm booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }

    const payment = await this.prisma.payment.findFirst({ where: { bookingId: id } });
    if (!payment || payment.status !== 'paid') {
      throw new ConflictException({
        statusCode: 409,
        message: 'Payment is required before confirming a booking',
        error: 'PAYMENT_REQUIRED',
      });
    }

    const confirmed = await this.prisma.booking.update({
      where: { id },
      data: { status: 'confirmed', confirmedAt: new Date() },
      include: bookingInclude,
    });

    if (confirmed.patientId) {
      const d = confirmed.date.toISOString().split('T')[0];
      await this.notificationsService.createNotification({
        userId: confirmed.patientId, type: 'booking_confirmed',
        titleAr: 'تأكيد الموعد', titleEn: 'Booking Confirmed',
        bodyAr: `تم تأكيد موعدك بتاريخ ${d} الساعة ${confirmed.startTime}`,
        bodyEn: `Your booking on ${d} at ${confirmed.startTime} has been confirmed`,
        data: { bookingId: id },
      });
    }

    this.activityLogService.log({
      action: 'booking_confirmed',
      module: 'bookings',
      resourceId: id,
      description: `Booking confirmed for ${confirmed.date.toISOString().split('T')[0]} at ${confirmed.startTime}`,
    }).catch(() => {});

    this.statusLogService.log({
      bookingId: id,
      fromStatus: booking.status,
      toStatus: 'confirmed',
    }).catch(() => {});

    return confirmed;
  }

  async checkIn(id: string) {
    const booking = await this.ensureBookingExists(id);
    if (booking.status !== 'confirmed') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot check in booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: 'checked_in', checkedInAt: new Date() },
      include: bookingInclude,
    });

    const practitioner = await this.prisma.practitioner.findUnique({
      where: { id: booking.practitionerId },
    });
    if (practitioner?.userId) {
      await this.notificationsService.createNotification({
        userId: practitioner.userId, type: 'booking_confirmed',
        titleAr: 'وصول المريض', titleEn: 'Patient Arrived',
        bodyAr: 'المريض وصل وجاهز للموعد', bodyEn: 'Patient has arrived and is ready',
        data: { bookingId: id },
      });
    }

    this.activityLogService.log({
      action: 'booking_checked_in',
      module: 'bookings',
      resourceId: id,
      description: 'Patient checked in for booking',
    }).catch(() => {});

    this.statusLogService.log({
      bookingId: id,
      fromStatus: booking.status,
      toStatus: 'checked_in',
    }).catch(() => {});

    return updated;
  }

  async startSession(id: string, practitionerUserId: string) {
    const booking = await this.ensureBookingExists(id);
    if (!['checked_in', 'confirmed'].includes(booking.status)) {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot start session for booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { userId: practitionerUserId },
    });
    if (!practitioner || practitioner.id !== booking.practitionerId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You can only start sessions for your own bookings',
        error: 'FORBIDDEN',
      });
    }
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: 'in_progress', inProgressAt: new Date() },
      include: bookingInclude,
    });

    this.activityLogService.log({
      action: 'booking_started',
      module: 'bookings',
      resourceId: id,
      userId: practitionerUserId,
      description: 'Practitioner started session',
    }).catch(() => {});

    this.statusLogService.log({
      bookingId: id,
      fromStatus: booking.status,
      toStatus: 'in_progress',
      changedBy: practitionerUserId,
    }).catch(() => {});

    return updated;
  }

  async complete(id: string, dto?: CompleteBookingDto) {
    const booking = await this.ensureBookingExists(id);
    if (!['confirmed', 'checked_in', 'in_progress'].includes(booking.status)) {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot complete booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }
    const completed = await this.prisma.booking.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date(), completionNotes: dto?.completionNotes },
      include: bookingInclude,
    });

    if (completed.patientId) {
      await this.notificationsService.createNotification({
        userId: completed.patientId, type: 'booking_completed',
        titleAr: 'اكتمل الموعد', titleEn: 'Booking Completed',
        bodyAr: 'تم اكتمال موعدك. يمكنك الآن تقييم تجربتك',
        bodyEn: 'Your booking is completed. You can now rate your experience',
        data: { bookingId: id },
      });
    }

    this.activityLogService.log({
      action: 'booking_completed',
      module: 'bookings',
      resourceId: id,
      description: 'Booking completed',
    }).catch(() => {});

    this.statusLogService.log({
      bookingId: id,
      fromStatus: booking.status,
      toStatus: 'completed',
    }).catch(() => {});

    return completed;
  }

  async markNoShow(id: string) {
    const booking = await this.ensureBookingExists(id);
    if (!['confirmed', 'in_progress'].includes(booking.status)) {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot mark no-show for booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: 'no_show' },
      include: bookingInclude,
    });

    this.activityLogService.log({
      action: 'booking_no_show',
      module: 'bookings',
      resourceId: id,
      description: 'Booking marked as no-show',
    }).catch(() => {});

    this.statusLogService.log({
      bookingId: id,
      fromStatus: booking.status,
      toStatus: 'no_show',
    }).catch(() => {});

    return updated;
  }

  private async ensureBookingExists(id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, deletedAt: null } });
    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }
    return booking;
  }
}
