import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { SubscriptionStateMachine } from '../subscription-state-machine';

export interface RecordSubscriptionPaymentFailureCommand {
  invoiceId: string;
  moyasarPaymentId: string;
  reason: string;
}

@Injectable()
export class RecordSubscriptionPaymentFailureHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: SubscriptionCacheService,
    private readonly stateMachine: SubscriptionStateMachine,
  ) {}

  async execute(cmd: RecordSubscriptionPaymentFailureCommand) {
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { id: cmd.invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const sub = invoice.subscription;
    const newStatus = this.stateMachine.transition(sub.status, { type: 'chargeFailure' });

    await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'FAILED',
          failureReason: cmd.reason,
          attemptCount: { increment: 1 },
          moyasarPaymentId: cmd.moyasarPaymentId,
        },
      });
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          organizationId: sub.organizationId, // explicit — Lesson 8
          status: newStatus,
          pastDueSince:
            newStatus === 'PAST_DUE' && !sub.pastDueSince ? new Date() : sub.pastDueSince,
          lastFailureReason: cmd.reason,
          retryCount: { increment: 1 },
        },
      });
    });

    this.cache.invalidate(sub.organizationId);
    return { ok: true };
  }
}
