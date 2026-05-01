import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY, SYSTEM_CONTEXT_CLS_KEY, TENANT_CLS_KEY } from '../../../common/tenant/tenant.constants';
import { MoyasarSubscriptionClient } from './moyasar-subscription.client';
import { RecordSubscriptionPaymentHandler } from '../../platform/billing/record-subscription-payment/record-subscription-payment.handler';
import { RecordSubscriptionPaymentFailureHandler } from '../../platform/billing/record-subscription-payment-failure/record-subscription-payment-failure.handler';

interface WebhookEvent {
  type: string;
  data: {
    id: string;
    status: string;
    source?: { message?: string };
  };
}

@Injectable()
export class MoyasarSubscriptionWebhookHandler {
  private readonly logger = new Logger(MoyasarSubscriptionWebhookHandler.name);

  constructor(
    private readonly client: MoyasarSubscriptionClient,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly recordPayment: RecordSubscriptionPaymentHandler,
    private readonly recordFailure: RecordSubscriptionPaymentFailureHandler,
  ) {}

  async execute(rawBody: Buffer, signature: string): Promise<{ ok: true }> {
    const rawStr = rawBody.toString('utf8');

    // Stage 1: verify signature
    if (!this.client.verifyWebhookSignature(rawStr, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let event: WebhookEvent;
    try {
      event = JSON.parse(rawStr) as WebhookEvent;
    } catch {
      throw new BadRequestException('Malformed webhook payload');
    }

    if (!event.type || !event.data?.id) {
      throw new BadRequestException('Malformed webhook payload');
    }

    // Stage 2: platform-level lookup (system context — no tenant filter)
    const invoice = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.subscriptionInvoice.findFirst({
        where: { moyasarPaymentId: event.data.id },
        include: { subscription: true },
      });
    });

    if (!invoice) {
      // Unknown payment — swallow and acknowledge
      this.logger.warn(`Subscription webhook: no invoice found for payment ${event.data.id}`);
      return { ok: true };
    }

    // Stage 3: enter tenant context for scoped writes.
    // Also set SUPER_ADMIN_CONTEXT_CLS_KEY so that billing handlers can call
    // prisma.$allTenants for cross-tenant owner email lookup without throwing.
    return this.cls.run(async () => {
      this.cls.set(TENANT_CLS_KEY, {
        organizationId: invoice.subscription.organizationId,
        membershipId: 'system',
        id: 'system',
        role: 'system',
        isSuperAdmin: false,
      });
      this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);

      if (event.type === 'payment_paid') {
        await this.recordPayment.execute({
          invoiceId: invoice.id,
          moyasarPaymentId: event.data.id,
        });
      } else if (event.type === 'payment_failed') {
        await this.recordFailure.execute({
          invoiceId: invoice.id,
          moyasarPaymentId: event.data.id,
          reason: event.data.source?.message ?? 'unknown',
        });
      } else {
        this.logger.debug(`Subscription webhook: unhandled event type ${event.type}`);
      }

      return { ok: true };
    });
  }
}
