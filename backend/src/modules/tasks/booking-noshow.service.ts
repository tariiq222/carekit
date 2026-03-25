import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../bookings/booking-settings.service.js';
import { WaitlistService } from '../bookings/waitlist.service.js';
import { CLINIC_TIMEZONE } from '../../config/constants/index.js';

@Injectable()
export class BookingNoShowService {
  private readonly logger = new Logger(BookingNoShowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly waitlistService: WaitlistService,
  ) {}

  /** Mark today's confirmed bookings as no-show if past the deadline */
  async autoNoShow(): Promise<void> {
    const settings = await this.bookingSettingsService.get();
    const now = new Date();

    const riyadhTodayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: CLINIC_TIMEZONE,
    }).format(now);
    const todayStart = new Date(`${riyadhTodayStr}T00:00:00+03:00`);
    const todayEnd = new Date(`${riyadhTodayStr}T23:59:59+03:00`);

    // Guard: only 'confirmed' — checked_in, in_progress, and pending_cancellation are explicitly excluded
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'confirmed',
        date: { gte: todayStart, lte: todayEnd },
        deletedAt: null,
      },
      select: {
        id: true,
        startTime: true,
        patientId: true,
        practitionerId: true,
        date: true,
        practitioner: { select: { userId: true } },
      },
    });

    const noShowBookings = bookings.filter((b) => {
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: CLINIC_TIMEZONE,
      }).format(b.date);
      const bookingStart = new Date(`${dateStr}T${b.startTime}:00+03:00`);
      const noShowDeadline = new Date(
        bookingStart.getTime() + settings.autoNoShowAfterMinutes * 60 * 1000,
      );
      return now > noShowDeadline;
    });

    for (const booking of noShowBookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'no_show', noShowAt: new Date() },
      });

      await this.processNoShowFinancials(
        booking.id,
        settings.noShowPolicy,
        settings.noShowRefundPercent,
      );

      if (booking.practitioner?.userId) {
        await this.notificationsService.createNotification({
          userId: booking.practitioner.userId,
          titleAr: 'لم يحضر المريض',
          titleEn: 'Patient No-Show',
          bodyAr: `لم يحضر المريض لموعد الساعة ${booking.startTime}`,
          bodyEn: `Patient did not show up for the ${booking.startTime} appointment`,
          type: 'booking_no_show',
          data: { bookingId: booking.id },
        });
      }

      if (booking.patientId) {
        await this.notificationsService.createNotification({
          userId: booking.patientId,
          titleAr: 'تم تسجيل عدم حضورك',
          titleEn: 'No-Show Recorded',
          bodyAr: `لم يتم تسجيل حضورك لموعد الساعة ${booking.startTime}`,
          bodyEn: `You were marked as no-show for the ${booking.startTime} appointment`,
          type: 'booking_no_show',
          data: { bookingId: booking.id },
        });
      }

      await this.waitlistService
        .checkAndNotify(booking.practitionerId, booking.date)
        .catch(() => {});
    }

    if (noShowBookings.length > 0) {
      this.logger.log(`Marked ${noShowBookings.length} bookings as no-show`);
      this.activityLogService
        .log({
          action: 'booking_no_show',
          module: 'bookings',
          description: `Auto-marked ${noShowBookings.length} bookings as no-show`,
        })
        .catch(() => {});
    }
  }

  private async processNoShowFinancials(
    bookingId: string,
    policy: string,
    refundPercent: number,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
    });
    if (!payment || payment.status !== 'paid') return;

    if (policy === 'keep_full') return;

    if (policy === 'partial_refund') {
      const refundAmount = Math.round(
        (payment.totalAmount * refundPercent) / 100,
      );
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'refunded', refundAmount },
      });
      return;
    }

    // admin_decides — notify admins for manual review
    const adminRoles = await this.prisma.userRole.findMany({
      where: { role: { slug: { in: ['super_admin', 'receptionist'] } } },
      select: { userId: true },
    });
    await Promise.all(
      adminRoles.map(({ userId }) =>
        this.notificationsService.createNotification({
          userId,
          titleAr: 'مراجعة مالية — عدم حضور',
          titleEn: 'No-Show Financial Review',
          bodyAr: 'مريض لم يحضر لموعده. يرجى تحديد سياسة الاسترجاع',
          bodyEn: 'A patient no-showed. Please decide on the refund policy',
          type: 'no_show_review',
          data: { bookingId },
        }),
      ),
    );
  }
}
