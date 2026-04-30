import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

export interface GetOrgBillingQuery {
  organizationId: string;
}

@Injectable()
export class GetOrgBillingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: GetOrgBillingQuery) {
    const org = await this.prisma.$allTenants.organization.findUnique({
      where: { id: q.organizationId },
      select: { id: true, slug: true, nameAr: true, nameEn: true, status: true },
    });
    if (!org) throw new NotFoundException(`Organization ${q.organizationId} not found`);

    const subscription = await this.prisma.$allTenants.subscription.findUnique({
      where: { organizationId: q.organizationId },
      include: { plan: { select: { slug: true, nameEn: true, priceMonthly: true } } },
    });

    const invoices = subscription
      ? await this.prisma.$allTenants.subscriptionInvoice.findMany({
          where: { subscriptionId: subscription.id },
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: {
            id: true,
            amount: true,
            flatAmount: true,
            overageAmount: true,
            currency: true,
            status: true,
            billingCycle: true,
            periodStart: true,
            periodEnd: true,
            dueDate: true,
            issuedAt: true,
            paidAt: true,
            refundedAmount: true,
            refundedAt: true,
            voidedReason: true,
            failureReason: true,
            createdAt: true,
          },
        })
      : [];

    const usage = subscription
      ? await this.prisma.$allTenants.usageRecord.findMany({
          where: {
            subscriptionId: subscription.id,
            periodStart: subscription.currentPeriodStart,
          },
          select: { metric: true, count: true, periodStart: true, periodEnd: true },
        })
      : [];

    const credits = await this.prisma.billingCredit.findMany({
      where: { organizationId: q.organizationId },
      orderBy: { grantedAt: 'desc' },
      select: {
        id: true,
        amount: true,
        currency: true,
        reason: true,
        grantedByUserId: true,
        grantedAt: true,
        consumedInvoiceId: true,
        consumedAt: true,
      },
    });

    const dunningLogs = subscription
      ? await this.prisma.$allTenants.dunningLog.findMany({
          where: { subscriptionId: subscription.id },
          orderBy: { executedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            subscriptionId: true,
            attemptNumber: true,
            status: true,
            scheduledFor: true,
            executedAt: true,
            failureReason: true,
          },
        })
      : [];

    return { org, subscription, invoices, usage, credits, dunningLogs };
  }
}
