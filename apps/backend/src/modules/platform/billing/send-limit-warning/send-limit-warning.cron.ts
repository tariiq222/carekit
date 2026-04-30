import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

const WARNING_THRESHOLD = 80;

interface SubscriptionWithPlan {
  id: string;
  organizationId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  plan: {
    limits: unknown;
  };
}

@Injectable()
export class SendLimitWarningCron {
  private readonly logger = new Logger(SendLimitWarningCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async execute(): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    const subscriptions = await this.prisma.$allTenants.subscription.findMany({
      where: { status: { in: ['ACTIVE', 'TRIALING'] } },
      include: { plan: true },
    });

    let sent = 0;
    for (const subscription of subscriptions as SubscriptionWithPlan[]) {
      const maxEmployees = this.maxEmployees(subscription.plan.limits);
      if (maxEmployees === null) continue;

      const activeEmployees = await this.prisma.$allTenants.employee.count({
        where: { organizationId: subscription.organizationId, isActive: true },
      });
      if (activeEmployees < Math.ceil(maxEmployees * (WARNING_THRESHOLD / 100))) continue;

      const owner = await this.prisma.$allTenants.membership.findFirst({
        where: { organizationId: subscription.organizationId, role: 'OWNER', isActive: true },
        include: { user: { select: { name: true } } },
      });
      if (!owner) continue;

      const existing = await this.prisma.$allTenants.notification.findFirst({
        where: {
          organizationId: subscription.organizationId,
          recipientId: owner.userId,
          type: 'GENERAL',
          createdAt: {
            gte: subscription.currentPeriodStart,
            lt: subscription.currentPeriodEnd,
          },
          AND: [
            { metadata: { path: ['kind'], equals: 'EMPLOYEES' } },
            { metadata: { path: ['threshold'], equals: WARNING_THRESHOLD } },
          ],
        },
      });
      if (existing) continue;

      await this.prisma.$allTenants.notification.create({
        data: {
          organizationId: subscription.organizationId,
          recipientId: owner.userId,
          recipientType: 'EMPLOYEE',
          type: 'GENERAL',
          title: 'Employee plan limit warning',
          body: `Active employees are at ${activeEmployees}/${maxEmployees} for this plan.`,
          metadata: {
            kind: 'EMPLOYEES',
            threshold: WARNING_THRESHOLD,
          } satisfies Prisma.InputJsonObject,
        },
      });
      sent += 1;
    }

    if (sent > 0) {
      this.logger.log(`Sent ${sent} usage limit warning notifications`);
    }
  }

  private maxEmployees(limits: unknown): number | null {
    if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return null;
    const maxEmployees = (limits as Record<string, unknown>)['maxEmployees'];
    if (typeof maxEmployees !== 'number' || !Number.isFinite(maxEmployees)) return null;
    if (maxEmployees <= 0) return null;
    return maxEmployees;
  }
}
