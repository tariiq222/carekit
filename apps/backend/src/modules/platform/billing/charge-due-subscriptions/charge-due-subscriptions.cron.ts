import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

interface SubWithPlan {
  id: string;
  organizationId: string;
  billingCycle: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
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

    // Until MoyasarSubscriptionClient.chargeWithToken is integrated (see
    // docs/superpowers/specs/2026-04-28-charge-due-subscriptions-moyasar-design.md),
    // the invoice is left in DUE state and a WARN is emitted so monitoring
    // surfaces the gap. Refusing to log silently — accumulating DUE invoices
    // without alerting was the pre-2026-04-28 behavior and meant zero
    // platform revenue was collected.
    this.logger.warn(
      `Invoice ${invoice.id} created in DUE state for subscription ${sub.id} — Moyasar charge integration pending; manual reconciliation required`,
    );
  }
}
