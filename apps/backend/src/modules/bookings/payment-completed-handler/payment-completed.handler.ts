import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/tenant/tenant.constants';
import { EventBusService } from '../../../infrastructure/events';

interface PaymentCompletedPayload {
  paymentId: string;
  invoiceId: string;
  bookingId: string;
}

/**
 * Subscribes to finance.payment.completed events.
 * Confirms the booking automatically when full payment is received.
 */
@Injectable()
export class PaymentCompletedEventHandler {
  private readonly logger = new Logger(PaymentCompletedEventHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  register(): void {
    this.eventBus.subscribe<PaymentCompletedPayload>(
      'finance.payment.completed',
      async (envelope) => {
        const { bookingId } = envelope.payload;
        try {
          const booking = await this.prisma.booking.findFirst({
            where: { id: bookingId },
          });
          if (!booking) return;
          if (booking.status !== 'PENDING' && booking.status !== 'AWAITING_PAYMENT') return;

          // Use the booking's own organizationId (event handlers run outside request CLS context)
          const organizationId = (booking as Record<string, unknown>).organizationId as string ?? DEFAULT_ORGANIZATION_ID;

          await this.prisma.$transaction([
            this.prisma.booking.update({
              where: { id: bookingId },
              data: { status: 'CONFIRMED', confirmedAt: new Date() },
            }),
            this.prisma.bookingStatusLog.create({
              data: {
                organizationId,
                bookingId,
                fromStatus: booking.status,
                toStatus: 'CONFIRMED',
                changedBy: 'system',
                reason: `payment:${envelope.payload.paymentId}`,
              },
            }),
          ]);
        } catch (err) {
          this.logger.error(`Failed to confirm booking ${bookingId} after payment`, err);
          throw err;
        }
      },
    );
  }
}
