import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { MoyasarSubscriptionClient } from '../../../finance/moyasar-api/moyasar-subscription.client';
import { RecordSubscriptionPaymentHandler } from '../record-subscription-payment/record-subscription-payment.handler';
import { RecordSubscriptionPaymentFailureHandler } from '../record-subscription-payment-failure/record-subscription-payment-failure.handler';

interface SubWithPlan {
  id: string;
  organizationId: string;
  billingCycle: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  moyasarCardTokenRef: string | null;
  plan: {
    priceMonthly: unknown;
    priceAnnual: unknown;
  };
}

@Injectable()
export class ChargeDueSubscriptionsCron {
  private readonly logger = new Logger(ChargeDueSubscriptionsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly moyasar: MoyasarSubscriptionClient,
    private readonly recordPayment: RecordSubscriptionPaymentHandler,
    private readonly recordFailure: RecordSubscriptionPaymentFailureHandler,
  ) {}

  async execute(): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    const now = new Date();
    const due = await this.prisma.subscription.findMany({
      where: {
        currentPeriodEnd: { lte: now },
        status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] },
      },
      include: { plan: true },
    });

    for (const sub of due) {
      await this.chargeSubscription(sub as SubWithPlan, now);
    }

    if (due.length > 0) {
      this.logger.log(`Processed ${due.length} due subscriptions`);
    }
  }

  private async chargeSubscription(sub: SubWithPlan, now: Date): Promise<void> {
    const flatAmount =
      sub.billingCycle === 'ANNUAL'
        ? Number(sub.plan.priceAnnual)
        : Number(sub.plan.priceMonthly);

    // Create invoice
    const invoice = await this.prisma.subscriptionInvoice.create({
      data: {
        subscriptionId: sub.id,
        organizationId: sub.organizationId,
        amount: flatAmount,
        flatAmount,
        overageAmount: 0,
        status: 'DUE',
        billingCycle: sub.billingCycle as never,
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
        dueDate: now,
      },
    });

    if (!sub.moyasarCardTokenRef) {
      this.logger.warn(
        `Invoice ${invoice.id} created in DUE state for subscription ${sub.id} — no saved Moyasar card token; manual reconciliation required`,
      );
      return;
    }

    try {
      const payment = await this.moyasar.chargeWithToken({
        token: sub.moyasarCardTokenRef,
        amount: Math.round(flatAmount * 100),
        currency: 'SAR',
        idempotencyKey: `subscription-invoice:${invoice.id}`,
        description: `CareKit subscription invoice ${invoice.id}`,
        callbackUrl: this.billingCallbackUrl(),
      });

      if (payment.status.toLowerCase() === 'paid') {
        await this.recordPayment.execute({
          invoiceId: invoice.id,
          moyasarPaymentId: payment.id,
        });
        return;
      }

      await this.recordFailure.execute({
        invoiceId: invoice.id,
        moyasarPaymentId: payment.id,
        reason: `Moyasar returned status ${payment.status}`,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Moyasar charge failed for subscription ${sub.id}, invoice ${invoice.id}: ${reason}`,
      );
      await this.recordFailure.execute({
        invoiceId: invoice.id,
        moyasarPaymentId: 'unavailable',
        reason,
      });
    }
  }

  private billingCallbackUrl(): string {
    const base =
      this.config.get<string>('BACKEND_URL') ??
      this.config.get<string>('DASHBOARD_PUBLIC_URL', '');
    return `${base.replace(/\/+$/, '')}/api/v1/public/billing/webhooks/moyasar`;
  }
}
