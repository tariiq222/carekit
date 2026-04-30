import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { DUNNING_MAX_RETRIES, DunningRetryService } from '../dunning-retry/dunning-retry.service';

@Injectable()
export class RetryFailedPaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly retryService: DunningRetryService,
  ) {}

  async execute(now = new Date()) {
    const organizationId = this.tenant.requireOrganizationId();
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        dunningRetryCount: true,
        nextRetryAt: true,
        invoices: {
          where: { status: { in: ['FAILED', 'DUE'] } },
          orderBy: { dueDate: 'desc' },
          take: 1,
          select: { id: true, amount: true },
        },
      },
    });

    if (!subscription) throw new NotFoundException('subscription_not_found');
    if (subscription.status !== 'PAST_DUE') {
      throw new UnprocessableEntityException('subscription_not_past_due');
    }
    if (subscription.dunningRetryCount >= DUNNING_MAX_RETRIES) {
      throw new UnprocessableEntityException('dunning_retry_budget_exhausted');
    }

    const [invoice] = subscription.invoices;
    if (!invoice) {
      throw new UnprocessableEntityException('no_failed_invoice_to_retry');
    }

    return this.retryService.retryInvoice({
      subscription: {
        id: subscription.id,
        organizationId: subscription.organizationId,
        dunningRetryCount: subscription.dunningRetryCount,
      },
      invoice,
      now,
      manual: true,
    });
  }
}
