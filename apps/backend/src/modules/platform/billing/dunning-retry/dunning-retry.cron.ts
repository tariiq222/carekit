import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../../common/tenant/tenant.constants';
import { DunningRetryService } from './dunning-retry.service';

@Injectable()
export class DunningRetryCron {
  private readonly logger = new Logger(DunningRetryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly retryService: DunningRetryService,
    private readonly cls: ClsService,
  ) {}

  async execute(now = new Date()): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    await this.cls.run(async () => {
      this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      await this.runRetries(now);
    });
  }

  private async runRetries(now: Date): Promise<void> {
    const subscriptions = await this.prisma.$allTenants.subscription.findMany({
      where: {
        status: 'PAST_DUE',
        nextRetryAt: { lte: now },
      },
      select: {
        id: true,
        organizationId: true,
        dunningRetryCount: true,
        invoices: {
          where: { status: { in: ['FAILED', 'DUE'] } },
          orderBy: { dueDate: 'desc' },
          take: 1,
          select: { id: true, amount: true },
        },
      },
    });

    let processed = 0;
    for (const subscription of subscriptions) {
      const [invoice] = subscription.invoices;
      if (!invoice) continue;
      await this.retryService.retryInvoice({
        subscription: {
          id: subscription.id,
          organizationId: subscription.organizationId,
          dunningRetryCount: subscription.dunningRetryCount,
        },
        invoice,
        now,
        manual: false,
      });
      processed += 1;
    }

    if (processed > 0) {
      this.logger.log(`Processed ${processed} dunning retry attempts`);
    }
  }
}
