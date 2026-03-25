import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../bookings/booking-settings.service.js';
import { WaitlistService } from '../bookings/waitlist.service.js';

@Injectable()
export class BookingAutomationService {
  private readonly logger = new Logger(BookingAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly waitlistService: WaitlistService,
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
        // Skip bookings that have a paid/processing payment (race protection)
        payment: { is: null },
      },
      select: {
        id: true,
        patientId: true,
        practitionerId: true,
        date: true,
        type: true,
        zoomMeetingId: true,
      },
    });

    // Double-check: also skip if payment was recently paid (narrow race window)
    const safeToExpire = [];
    for (const booking of expiredBookings) {
      const paidPayment = await this.prisma.payment.findFirst({
        where: { bookingId: booking.id, status: { in: ['paid', 'pending'] } },
        select: { id: true },
      });
      if (!paidPayment) {
        safeToExpire.push(booking);
      } else {
        this.logger.warn(
          `Skipping expire for booking ${booking.id} — payment still active`,
        );
      }
    }

    for (const booking of safeToExpire) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'expired', cancelledBy: 'system' },
      });

      // Delete unpaid payment record (only awaiting — never delete pending mid-payment)
      await this.prisma.payment.deleteMany({
        where: {
          bookingId: booking.id,
          status: 'awaiting',
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

      // Notify waitlist — slot is now free
      await this.waitlistService.checkAndNotify(
        booking.practitionerId, booking.date,
      ).catch(() => {});
    }

    if (safeToExpire.length > 0) {
      this.logger.log(`Expired ${safeToExpire.length} pending bookings`);
      this.activityLogService.log({
        action: 'booking_expired',
        module: 'bookings',
        description: `Auto-expired ${safeToExpire.length} pending bookings`,
      }).catch(() => {});
    }
  }

  /** Auto-complete bookings that are past the auto-complete window */
  async autoCompleteBookings(): Promise<void> {
    const settings = await this.bookingSettingsService.get();
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Fetch candidate bookings: date <= today, not future
    const candidates = await this.prisma.booking.findMany({
      where: {
        status: { in: ['confirmed', 'in_progress', 'checked_in'] },
        date: { lt: tomorrow },
        deletedAt: null,
      },
      select: { id: true, patientId: true, date: true, endTime: true },
    });
    // Filter: only complete if now > bookingEndTime + autoCompleteAfterHours
    const autoCompleteMs = settings.autoCompleteAfterHours * 60 * 60 * 1000;
    const bookings = candidates.filter((b) => {
      const bookingEnd = new Date(b.date);
      const [h, m] = b.endTime.split(':').map(Number);
      bookingEnd.setHours(h, m, 0, 0);
      return now.getTime() > bookingEnd.getTime() + autoCompleteMs;
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
        practitionerId: true,
        date: true,
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

      await this.processNoShowFinancials(booking.id, settings.noShowPolicy, settings.noShowRefundPercent);

      // Notify practitioner
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

      // Notify patient
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

      // Notify waitlist — slot is now free
      await this.waitlistService.checkAndNotify(
        booking.practitionerId, booking.date,
      ).catch(() => {});
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

  /** Auto-approve stale pending_cancellation requests after timeout */
  async autoExpirePendingCancellations(): Promise<void> {
    const settings = await this.bookingSettingsService.get();
    const cutoff = new Date(
      Date.now() - settings.cancellationReviewTimeoutHours * 60 * 60 * 1000,
    );

    const staleBookings = await this.prisma.booking.findMany({
      where: {
        status: 'pending_cancellation',
        updatedAt: { lt: cutoff },
        deletedAt: null,
      },
      select: {
        id: true,
        patientId: true,
        practitionerId: true,
        date: true,
      },
    });

    for (const booking of staleBookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'cancelled',
          cancelledBy: 'system',
          cancelledAt: new Date(),
          adminNotes: `Auto-approved after ${settings.cancellationReviewTimeoutHours}h timeout`,
        },
      });

      // Full refund for timeout — clinic failed to respond
      const payment = await this.prisma.payment.findUnique({
        where: { bookingId: booking.id },
      });
      if (payment && payment.status === 'paid') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'refunded', refundAmount: payment.totalAmount },
        });
      }

      if (booking.patientId) {
        await this.notificationsService.createNotification({
          userId: booking.patientId,
          titleAr: 'تمت الموافقة على إلغاء موعدك',
          titleEn: 'Cancellation Auto-Approved',
          bodyAr: 'تمت الموافقة تلقائياً على طلب إلغاء موعدك مع استرداد كامل',
          bodyEn: 'Your cancellation request was auto-approved with a full refund',
          type: 'booking_cancelled',
          data: { bookingId: booking.id },
        });
      }

      await this.waitlistService.checkAndNotify(
        booking.practitionerId, booking.date,
      ).catch(() => {});
    }

    if (staleBookings.length > 0) {
      this.logger.log(`Auto-approved ${staleBookings.length} stale cancellation requests`);
      this.activityLogService.log({
        action: 'cancellation_auto_approved',
        module: 'bookings',
        description: `Auto-approved ${staleBookings.length} stale pending_cancellation requests`,
      }).catch(() => {});
    }
  }

  // ───────────────────────────────────────────────────────────────
  //  Private: No-show financial processing
  // ───────────────────────────────────────────────────────────────

  private async processNoShowFinancials(
    bookingId: string,
    policy: string,
    refundPercent: number,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
    });
    if (!payment || payment.status !== 'paid') return;

    if (policy === 'keep_full') {
      // Clinic keeps full amount — no action needed
      return;
    }

    if (policy === 'partial_refund') {
      const refundAmount = Math.round(payment.totalAmount * refundPercent / 100);
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
    await Promise.all(adminRoles.map(({ userId }) =>
      this.notificationsService.createNotification({
        userId,
        titleAr: 'مراجعة مالية — عدم حضور',
        titleEn: 'No-Show Financial Review',
        bodyAr: 'مريض لم يحضر لموعده. يرجى تحديد سياسة الاسترجاع',
        bodyEn: 'A patient no-showed. Please decide on the refund policy',
        type: 'no_show_review',
        data: { bookingId },
      }),
    ));
  }
}
