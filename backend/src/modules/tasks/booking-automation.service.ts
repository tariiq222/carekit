import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../bookings/booking-settings.service.js';

@Injectable()
export class BookingAutomationService {
  private readonly logger = new Logger(BookingAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly bookingSettingsService: BookingSettingsService,
  ) {}

  /** Expire pending bookings that exceeded the payment timeout */
  async expirePendingBookings(): Promise<void> {
    const settings = await this.bookingSettingsService.get();
    const cutoff = new Date(
      Date.now() - settings.paymentTimeoutMinutes * 60 * 1000,
    );

    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: 'pending',
        isWalkIn: false,
        createdAt: { lt: cutoff },
        deletedAt: null,
      },
      select: {
        id: true,
        patientId: true,
        type: true,
        zoomMeetingId: true,
      },
    });

    for (const booking of expiredBookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'expired', cancelledBy: 'system' },
      });

      // Delete unpaid payment record
      await this.prisma.payment.deleteMany({
        where: {
          bookingId: booking.id,
          status: { in: ['awaiting', 'pending'] },
        },
      });

      // Notify patient
      if (booking.patientId) {
        await this.notificationsService.createNotification({
          userId: booking.patientId,
          titleAr: 'انتهت صلاحية الحجز',
          titleEn: 'Booking Expired',
          bodyAr: 'انتهت صلاحية حجزك بسبب عدم إتمام الدفع',
          bodyEn: 'Your booking has expired due to incomplete payment',
          type: 'booking_expired',
          data: { bookingId: booking.id },
        });
      }
    }

    if (expiredBookings.length > 0) {
      this.logger.log(`Expired ${expiredBookings.length} pending bookings`);
      this.activityLogService.log({
        action: 'booking_expired',
        module: 'bookings',
        description: `Auto-expired ${expiredBookings.length} pending bookings`,
      }).catch(() => {});
    }
  }

  /** Auto-complete bookings that are past the auto-complete window */
  async autoCompleteBookings(): Promise<void> {
    const settings = await this.bookingSettingsService.get();
    const cutoff = new Date(
      Date.now() - settings.autoCompleteAfterHours * 60 * 60 * 1000,
    );

    // Find bookings where the entire day is past the auto-complete window
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: { in: ['confirmed', 'in_progress', 'checked_in'] },
        date: { lt: cutoff },
        deletedAt: null,
      },
      select: { id: true, patientId: true },
    });

    for (const booking of bookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'completed', completedAt: new Date() },
      });
    }

    if (bookings.length > 0) {
      this.logger.log(`Auto-completed ${bookings.length} bookings`);
      this.activityLogService.log({
        action: 'booking_auto_completed',
        module: 'bookings',
        description: `Auto-completed ${bookings.length} bookings`,
      }).catch(() => {});
    }
  }

  /** Mark today's confirmed bookings as no-show if past the deadline */
  async autoNoShow(): Promise<void> {
    const settings = await this.bookingSettingsService.get();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cutoffMinutes = settings.autoNoShowAfterMinutes;

    // Find today's confirmed bookings (not checked_in or in_progress)
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'confirmed',
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
        deletedAt: null,
      },
      select: {
        id: true,
        startTime: true,
        patientId: true,
        practitioner: { select: { userId: true } },
      },
    });

    const noShowBookings = bookings.filter((b) => {
      const [h, m] = b.startTime.split(':').map(Number);
      const bookingStart = new Date(today);
      bookingStart.setHours(h, m, 0, 0);
      const noShowDeadline = new Date(
        bookingStart.getTime() + cutoffMinutes * 60 * 1000,
      );
      return now > noShowDeadline;
    });

    for (const booking of noShowBookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'no_show', noShowAt: new Date() },
      });

      // Notify practitioner
      if (booking.practitioner?.userId) {
        await this.notificationsService.createNotification({
          userId: booking.practitioner.userId,
          titleAr: 'لم يحضر المريض',
          titleEn: 'Patient No-Show',
          bodyAr: `لم يحضر المريض لموعد الساعة ${booking.startTime}`,
          bodyEn: `Patient did not show up for the ${booking.startTime} appointment`,
          type: 'booking_cancelled',
          data: { bookingId: booking.id },
        });
      }
    }

    if (noShowBookings.length > 0) {
      this.logger.log(
        `Marked ${noShowBookings.length} bookings as no-show`,
      );
      this.activityLogService.log({
        action: 'booking_no_show',
        module: 'bookings',
        description: `Auto-marked ${noShowBookings.length} bookings as no-show`,
      }).catch(() => {});
    }
  }
}
