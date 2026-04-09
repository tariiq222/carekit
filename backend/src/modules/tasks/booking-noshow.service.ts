import { Injectable, Logger } from '@nestjs/common';
import { NoShowPolicy } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../bookings/booking-settings.service.js';
import { BookingStatusLogService } from '../bookings/booking-status-log.service.js';
import { WaitlistService } from '../bookings/waitlist.service.js';
import { MoyasarRefundService } from '../payments/moyasar-refund.service.js';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service.js';

@Injectable()
export class BookingNoShowService {
  private readonly logger = new Logger(BookingNoShowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly statusLogService: BookingStatusLogService,
    private readonly waitlistService: WaitlistService,
    private readonly moyasarRefundService: MoyasarRefundService,
    private readonly clinicSettingsService: ClinicSettingsService,
  ) {}

  /** Mark today's confirmed bookings as no-show if past the deadline */
  async autoNoShow(): Promise<void> {
    const settings = await this.bookingSettingsService.get();
    const clinicTz = await this.clinicSettingsService.getTimezone();
    const now = new Date();

    const riyadhTodayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: clinicTz,
    }).format(now);
    const tzOffsetMs = this.getTimezoneOffsetMs(clinicTz, now);
    const todayStart = new Date(new Date(`${riyadhTodayStr}T00:00:00Z`).getTime() - tzOffsetMs);
    const todayEnd = new Date(new Date(`${riyadhTodayStr}T23:59:59Z`).getTime() - tzOffsetMs);

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
        timeZone: clinicTz,
      }).format(b.date);
      const bookingStart = new Date(new Date(`${dateStr}T${b.startTime}:00Z`).getTime() - tzOffsetMs);
      const noShowDeadline = new Date(
        bookingStart.getTime() + settings.autoNoShowAfterMinutes * 60 * 1000,
      );
      return now > noShowDeadline;
    });

    for (const booking of noShowBookings) {
      try {
        // Atomic: re-check status inside transaction to prevent race with check-in
        const transitioned = await this.prisma.$transaction(async (tx) => {
          const current = await tx.booking.findFirst({
            where: { id: booking.id, status: 'confirmed', deletedAt: null },
            select: { id: true },
          });
          if (!current) return false; // Already transitioned (checked-in or cancelled)

          await tx.booking.update({
            where: { id: booking.id },
            data: { status: 'no_show', noShowAt: new Date() },
          });

          // Financial processing inside transaction for atomicity (non-Moyasar only)
          await this.processNoShowFinancialsInTx(
            tx,
            booking.id,
            settings.noShowPolicy,
            settings.noShowRefundPercent,
          );

          return true;
        }, { isolationLevel: 'Serializable', timeout: 10000 });

        if (!transitioned) continue;

        // Moyasar partial_refund: must be called outside the transaction (requires external API)
        if (settings.noShowPolicy === NoShowPolicy.partial_refund) {
          const payment = await this.prisma.payment.findUnique({ where: { bookingId: booking.id } });
          if (payment && payment.status === 'paid' && payment.method === 'moyasar') {
            const refundAmount = Math.round((payment.totalAmount * settings.noShowRefundPercent) / 100);
            try {
              await this.moyasarRefundService.refund(payment.id, refundAmount);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'unknown';
              this.logger.error(
                `Moyasar partial refund failed for no-show booking ${booking.id}: ${msg}`,
              );
              // Record the failure on the payment so admins can see it requires manual action.
              // Payment status intentionally stays 'paid' — money was not refunded.
              await this.prisma.payment.update({
                where: { id: payment.id },
                data: { refundReason: `partial_refund_failed: ${msg}` },
              }).catch((err) => this.logger.warn('Payment update failed', { error: err?.message }));
              // Notify admins for manual resolution
              this.prisma.userRole.findMany({
                where: { role: { slug: { in: ['super_admin', 'receptionist'] } } },
                select: { userId: true },
              }).then((adminRoles) =>
                Promise.all(
                  adminRoles.map(({ userId }) =>
                    this.notificationsService.createNotification({
                      userId,
                      titleAr: 'فشل الاسترداد التلقائي — مراجعة يدوية مطلوبة',
                      titleEn: 'Auto-Refund Failed — Manual Review Required',
                      bodyAr: `فشل استرداد جزء من مبلغ حجز رقم ${booking.id}. يرجى المراجعة اليدوية.`,
                      bodyEn: `Partial refund for no-show booking ${booking.id} failed. Manual action required.`,
                      type: 'system_alert',
                      data: { bookingId: booking.id, paymentId: payment.id },
                    }),
                  ),
                ),
              ).catch((err) => this.logger.warn('Admin notification failed', { error: err?.message }));
            }
          }
        }

        this.statusLogService.log({
          bookingId: booking.id,
          fromStatus: 'confirmed',
          toStatus: 'no_show',
          changedBy: 'system',
          reason: `Auto no-show after ${settings.autoNoShowAfterMinutes} minutes`,
        }).catch((err) => this.logger.warn('Status log failed', { error: err?.message }));

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
          .catch((err) => this.logger.warn('Waitlist notify failed', { error: err?.message }));
      } catch (err) {
        this.logger.warn(`Failed to mark booking ${booking.id} as no-show: ${(err as Error).message}`);
      }
    }

    if (noShowBookings.length > 0) {
      this.logger.log(`Marked ${noShowBookings.length} bookings as no-show`);
      this.activityLogService
        .log({
          action: 'booking_no_show',
          module: 'bookings',
          description: `Auto-marked ${noShowBookings.length} bookings as no-show`,
        })
        .catch((err) => this.logger.warn('Activity log failed', { error: err?.message }));
    }
  }

  /**
   * Get the UTC offset in milliseconds for a given IANA timezone at a specific point in time.
   * e.g. 'Asia/Riyadh' returns +10800000 (3 hours), 'Asia/Karachi' returns +18000000 (5 hours)
   */
  private getTimezoneOffsetMs(tz: string, referenceDate: Date): number {
    const utcStr = referenceDate.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = referenceDate.toLocaleString('en-US', { timeZone: tz });
    return new Date(tzStr).getTime() - new Date(utcStr).getTime();
  }

  /**
   * Financial processing inside a transaction (non-Moyasar payments only).
   * Moyasar requires an external API call — handled separately after tx commits.
   */
  private async processNoShowFinancialsInTx(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    bookingId: string,
    policy: NoShowPolicy,
    refundPercent: number,
  ): Promise<void> {
    const payment = await tx.payment.findUnique({ where: { bookingId } });
    if (!payment || payment.status !== 'paid') return;
    if (policy === NoShowPolicy.keep_full) return;

    if (policy === NoShowPolicy.partial_refund) {
      // Moyasar refunds require an API call — skip here, handled via MoyasarRefundService post-tx
      if (payment.method === 'moyasar') return;

      const refundAmount = Math.round((payment.totalAmount * refundPercent) / 100);
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'refunded',
          refundAmount,
          refundedAt: new Date(),
          refundedBy: 'system',
          refundReason: 'no_show_partial_refund',
        },
      });
      return;
    }

    // admin_decides — notify admins for manual review (outside tx, non-critical)
    this.prisma.userRole.findMany({
      where: { role: { slug: { in: ['super_admin', 'receptionist'] } } },
      select: { userId: true },
    }).then((adminRoles) =>
      Promise.all(
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
      ),
    ).catch((err) => this.logger.warn('Admin notification failed', { error: err?.message }));
  }
}
