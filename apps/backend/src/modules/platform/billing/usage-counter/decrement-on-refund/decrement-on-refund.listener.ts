import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { EventBusService } from '../../../../../infrastructure/events';
import { PrismaService } from '../../../../../infrastructure/database/prisma.service';
import { TENANT_CLS_KEY } from '../../../../../common/tenant/tenant.constants';
import { UsageCounterService } from '../usage-counter.service';
import { startOfMonthUTC } from '../period.util';

interface RefundCompletedPayload {
  refundRequestId: string;
  organizationId: string;
  invoiceId: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
}

/**
 * DecrementOnRefundListener
 *
 * Phase 2 / Bug B11 — refund must decrement UsageCounter so a refunded
 * booking does not count toward the org's monthly_bookings overage.
 *
 * What we revert (and why):
 *   ▸ MONTHLY_BOOKINGS — yes. A refunded booking is no longer "consumed
 *     usage"; it must come back out of the period counter.
 *   ▸ STORAGE — no. Files attached to a refunded transaction are not
 *     auto-deleted (separate cleanup concern).
 *   ▸ BRANCHES, EMPLOYEES, SERVICES — no. These are entity-lifecycle
 *     counters that decrement on deactivation, not on refund.
 *
 * Idempotency:
 *   The listener inserts a `RefundUsageRevertLog` row (unique on
 *   `(refundRequestId, metric)`) BEFORE decrementing. If the event is
 *   replayed the insert throws P2002 and we short-circuit — the counter
 *   is decremented exactly once per (refund, metric).
 *
 * Period window:
 *   We only decrement when the booking falls inside the CURRENT monthly
 *   period. A refund processed after period rollover should NOT touch
 *   last month's frozen counter (already metered into UsageRecord).
 */
@Injectable()
export class DecrementOnRefundListener implements OnModuleInit {
  private readonly logger = new Logger(DecrementOnRefundListener.name);

  constructor(
    private readonly counters: UsageCounterService,
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<RefundCompletedPayload>(
      'finance.refund.completed',
      async (envelope) => {
        try {
          await this.handle(envelope.payload);
        } catch (err: unknown) {
          this.logger.error(
            { err, refundRequestId: envelope.payload.refundRequestId },
            'usage_counter_refund_decrement_failed',
          );
        }
      },
    );
  }

  /**
   * Public for unit tests — wraps the listener body in tenant CLS so
   * scoped-model reads/writes (Booking lookup, RefundUsageRevertLog) pass
   * the tenant-scoping extension under strict mode.
   */
  async handle(payload: RefundCompletedPayload): Promise<void> {
    await this.cls.run(async () => {
      this.cls.set(TENANT_CLS_KEY, {
        organizationId: payload.organizationId,
        membershipId: 'system',
        id: 'system',
        role: 'system',
        isSuperAdmin: false,
      });

      // Step 1 — fetch booking to determine whether it falls in the
      // current monthly period. (organizationId scope is auto-injected.)
      const booking = await this.prisma.booking.findFirst({
        where: { id: payload.bookingId },
        select: { id: true, scheduledAt: true, organizationId: true },
      });

      if (!booking) {
        this.logger.warn(
          { refundRequestId: payload.refundRequestId, bookingId: payload.bookingId },
          'refund_booking_missing_skip_decrement',
        );
        return;
      }

      const currentPeriod = startOfMonthUTC();
      const bookingPeriod = startOfMonthUTC(booking.scheduledAt);
      if (bookingPeriod.getTime() !== currentPeriod.getTime()) {
        this.logger.log(
          { refundRequestId: payload.refundRequestId, bookingPeriod, currentPeriod },
          'refund_booking_outside_current_period_skip_decrement',
        );
        return;
      }

      // Step 2 — claim the (refundRequestId, MONTHLY_BOOKINGS) idempotency
      // slot. If the row already exists we have already decremented; no-op.
      try {
        await this.prisma.refundUsageRevertLog.create({
          data: {
            organizationId: payload.organizationId,
            refundRequestId: payload.refundRequestId,
            metric: FeatureKey.MONTHLY_BOOKINGS,
            amount: -1,
          },
        });
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          this.logger.log(
            { refundRequestId: payload.refundRequestId },
            'refund_usage_revert_already_logged_skip',
          );
          return;
        }
        throw err;
      }

      // Step 3 — actually decrement the counter (negative `by`).
      await this.counters.increment(
        payload.organizationId,
        FeatureKey.MONTHLY_BOOKINGS,
        currentPeriod,
        -1,
      );
    });
  }
}
