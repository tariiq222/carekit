import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { SubscriptionStateMachine } from '../subscription-state-machine';

export interface RecordSubscriptionPaymentCommand {
  invoiceId: string;
  moyasarPaymentId: string;
}

@Injectable()
export class RecordSubscriptionPaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: SubscriptionCacheService,
    private readonly stateMachine: SubscriptionStateMachine,
  ) {}

  async execute(cmd: RecordSubscriptionPaymentCommand) {
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { id: cmd.invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const sub = invoice.subscription;
    const newStatus = this.stateMachine.transition(sub.status, { type: 'chargeSuccess' });

    await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionInvoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidAt: new Date(), moyasarPaymentId: cmd.moyasarPaymentId },
      });
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          organizationId: sub.organizationId, // explicit — Lesson 8
          status: newStatus,
          pastDueSince: null,
          lastPaymentAt: new Date(),
          retryCount: 0,
        },
      });
    });

    this.cache.invalidate(sub.organizationId);
    return { ok: true };
  }
}
