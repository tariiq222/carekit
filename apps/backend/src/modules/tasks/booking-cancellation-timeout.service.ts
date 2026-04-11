import { Injectable, Logger } from '@nestjs/common';
import { CancelledBy } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { MessagingDispatcherService } from '../messaging/core/messaging-dispatcher.service.js';
import { MessagingEvent } from '../messaging/core/messaging-events.js';
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
    private readonly messagingDispatcher: MessagingDispatcherService,
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
        suggestedRefundType: true,
      },
    });

    for (const booking of staleBookings) {
      try {
        // Atomic: re-check status inside transaction to prevent race with manual approveCancellation
        const result = await this.prisma.$transaction(
          async (tx) => {
            const current = await tx.booking.findFirst({
              where: {
                id: booking.id,
                status: 'pending_cancellation',
                deletedAt: null,
              },
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

            // Apply refund based on the original suggestedRefundType
            const refundType = booking.suggestedRefundType ?? 'full';
            const p = await tx.payment.findUnique({
              where: { bookingId: booking.id },
            });
            if (p && p.status === 'paid' && p.method !== 'moyasar') {
              const refundAmount =
                refundType === 'none'
                  ? 0
                  : refundType === 'partial'
                    ? p.amount  // base amount without VAT
                    : p.totalAmount; // full refund
              await tx.payment.update({
                where: { id: p.id },
                data: {
                  status: refundType === 'none' ? 'paid' : 'refunded',
                  refundAmount,
                  refundedAt: refundType === 'none' ? null : new Date(),
                  refundedBy: refundType === 'none' ? null : 'system',
                  refundReason: `auto_cancellation_timeout_${settings.cancellationReviewTimeoutHours}h`,
                },
              });
            }

            return { payment: p, refundType };
          },
          { isolationLevel: 'Serializable', timeout: 10000 },
        );

        if (result === null) continue; // Was already processed by manual approval
        const { payment, refundType } = result;

        this.statusLogService
          .log({
            bookingId: booking.id,
            fromStatus: 'pending_cancellation',
            toStatus: 'cancelled',
            changedBy: 'system',
            reason: `Auto-approved after ${settings.cancellationReviewTimeoutHours}h timeout`,
          })
          .catch((err) =>
            this.logger.warn('Status log failed', { error: err?.message }),
          );

        // Moyasar refund — only when refund is owed
        if (
          payment &&
          payment.status === 'paid' &&
          payment.method === 'moyasar' &&
          payment.moyasarPaymentId &&
          refundType !== 'none'
        ) {
          const refundAmount =
            refundType === 'partial' ? payment.amount : payment.totalAmount;
          try {
            await this.moyasarRefundService.refund(payment.id, refundAmount);
          } catch (err) {
            this.logger.error(
              `Moyasar refund failed for auto-cancelled booking ${booking.id}: ${err instanceof Error ? err.message : 'unknown'}`,
            );
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: 'refunded',
                refundAmount,
                refundedAt: new Date(),
                refundedBy: 'system',
                refundReason: `auto_cancellation_timeout_moyasar_fallback`,
              },
            });
          }
        }

        if (booking.patientId) {
          await this.messagingDispatcher.dispatch({
            event: MessagingEvent.BOOKING_CANCELLATION_REJECTED,
            recipientUserId: booking.patientId,
            context: {},
          });
        }

        await this.waitlistService
          .checkAndNotify(booking.practitionerId, booking.date)
          .catch((err) =>
            this.logger.warn('Waitlist notify failed', { error: err?.message }),
          );
      } catch (err) {
        this.logger.warn(
          `Failed to auto-approve cancellation for booking ${booking.id}: ${(err as Error).message}`,
        );
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
        .catch((err) =>
          this.logger.warn('Activity log failed', { error: err?.message }),
        );
    }
  }
}
