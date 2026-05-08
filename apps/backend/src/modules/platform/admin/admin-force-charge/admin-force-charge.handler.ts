import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SuperAdminActionType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { DunningRetryService } from '../../billing/dunning-retry/dunning-retry.service';

export interface AdminForceChargeCommand {
  organizationId: string;
  superAdminUserId: string;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class AdminForceChargeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dunning: DunningRetryService,
  ) {}

  async execute(cmd: AdminForceChargeCommand) {
    const subscription = await this.prisma.$allTenants.subscription.findUnique({
      where: { organizationId: cmd.organizationId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        dunningRetryCount: true,
        invoices: {
          where: { status: { in: ['FAILED', 'DUE'] } },
          orderBy: { dueDate: 'desc' },
          take: 1,
          select: { id: true, amount: true },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException(`No subscription found for organization ${cmd.organizationId}`);
    }

    if (subscription.status !== 'PAST_DUE') {
      throw new BadRequestException(
        `Subscription is not PAST_DUE (current status: ${subscription.status})`,
      );
    }

    const defaultCard = await this.prisma.$allTenants.savedCard.findFirst({
      where: { organizationId: cmd.organizationId, isDefault: true },
      select: { id: true },
    });

    if (!defaultCard) {
      throw new BadRequestException('no default card on file for this organization');
    }

    const [invoice] = subscription.invoices;
    if (!invoice) {
      throw new BadRequestException('no failed or due invoice to retry');
    }

    // Write audit log BEFORE invoking dunning so the attempt is recorded
    // even if the external Moyasar call fails. The dunning result is observable
    // separately via invoice.status / subscription.dunningRetryCount changes.
    await this.prisma.$allTenants.superAdminActionLog.create({
      data: {
        superAdminUserId: cmd.superAdminUserId,
        actionType: SuperAdminActionType.BILLING_FORCE_CHARGE,
        organizationId: cmd.organizationId,
        reason: 'Manual force-charge initiated by super-admin',
        metadata: {
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          action: 'FORCE_CHARGE_ATTEMPTED',
        },
        ipAddress: cmd.ipAddress,
        userAgent: cmd.userAgent,
      },
    });

    const result = await this.dunning.retryInvoice({
      subscription: {
        id: subscription.id,
        organizationId: subscription.organizationId,
        dunningRetryCount: subscription.dunningRetryCount,
      },
      invoice,
      now: new Date(),
      manual: true,
    });

    return { success: true, message: 'Retry initiated', result };
  }
}
