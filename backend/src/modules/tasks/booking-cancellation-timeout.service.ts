import { Injectable, Logger } from '@nestjs/common';
import { CancelledBy } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../bookings/booking-settings.service.js';
import { BookingStatusLogService } from '../bookings/booking-status-log.service.js';
import { WaitlistService } from '../bookings/waitlist.service.js';
import { MoyasarRefundService } from '../payments/moyasar-refund.service.js';

@Injectable()
export class BookingCancellationTimeoutService {
  private readonly logger = new Logger(BookingCancellationTimeoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly statusLogService: BookingStatusLogService,
    private readonly waitlistService: WaitlistService,
    private readonly moyasarRefundService: MoyasarRefundService,
  ) {}

  /** Auto-approve stale pending_cancellation requests after timeout */
  async autoExpirePendingCancellations(): Promise<void> {
    const settings = await this.bookingSettingsService.get();
    const cutoff = new Date(
      Date.now() -
        settings.cancellationReviewTimeoutHours * 60 * 60 * 1000,
    );

    const staleBookings = await this.prisma.booking.findMany({
      where: {
        status: 'pending_cancellation',
        updatedAt: { lt: cutoff },
        deletedAt: null,
      },
      select: { id: true, patientId: true, practitionerId: true, date: true },
    });

    for (const booking of staleBookings) {
      try {
        // Atomic: re-check status inside transaction to prevent race with manual approveCancellation
        const result = await this.prisma.$transaction(async (tx) => {
          const current = await tx.booking.findFirst({
            where: { id: booking.id, status: 'pending_cancellation', deletedAt: null },
            select: { id: true },
          });
          if (!current) return null; // Already processed by manual approval

          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: 'cancelled',
              cancelledBy: CancelledBy.system,
              cancelledAt: new Date(),
              adminNotes: `Auto-approved after ${settings.cancellationReviewTimeoutHours}h timeout`,
            },
          });

          // For non-Moyasar: update payment inside the transaction (atomic)
          const p = await tx.payment.findUnique({ where: { bookingId: booking.id } });
          if (p && p.status === 'paid' && p.method !== 'moyasar') {
            await tx.payment.update({
              where: { id: p.id },
              data: {
                status: 'refunded',
                refundAmount: p.totalAmount,
                refundedAt: new Date(),
                refundedBy: 'system',
                refundReason: `auto_cancellation_timeout_${settings.cancellationReviewTimeoutHours}h`,
              },
            });
          }

          return { payment: p }; // Wrap in object to distinguish "no payment" from "not processed"
        }, { isolationLevel: 'Serializable', timeout: 10000 });

        if (result === null) continue; // Was already processed by manual approval
        const { payment } = result;

        this.statusLogService.log({
          bookingId: booking.id,
          fromStatus: 'pending_cancellation',
          toStatus: 'cancelled',
          changedBy: 'system',
          reason: `Auto-approved after ${settings.cancellationReviewTimeoutHours}h timeout`,
        }).catch(() => {});

        // Moyasar refund must be called outside the transaction (external API)
        if (payment && payment.status === 'paid' && payment.method === 'moyasar' && payment.moyasarPaymentId) {
          try {
            await this.moyasarRefundService.refund(payment.id, payment.totalAmount);
          } catch (err) {
            this.logger.error(
              `Moyasar refund failed for auto-cancelled booking ${booking.id}: ${err instanceof Error ? err.message : 'unknown'}`,
            );
            // Mark as refunded in DB so admin can reconcile manually
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: 'refunded',
                refundAmount: payment.totalAmount,
                refundedAt: new Date(),
                refundedBy: 'system',
                refundReason: `auto_cancellation_timeout_moyasar_fallback`,
              },
            });
          }
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

        await this.waitlistService
          .checkAndNotify(booking.practitionerId, booking.date)
          .catch(() => {});
      } catch (err) {
        this.logger.warn(`Failed to auto-approve cancellation for booking ${booking.id}: ${(err as Error).message}`);
      }
    }

    if (staleBookings.length > 0) {
      this.logger.log(
        `Auto-approved ${staleBookings.length} stale cancellation requests`,
      );
      this.activityLogService
        .log({
          action: 'cancellation_auto_approved',
          module: 'bookings',
          description: `Auto-approved ${staleBookings.length} stale pending_cancellation requests`,
        })
        .catch(() => {});
    }
  }
}
