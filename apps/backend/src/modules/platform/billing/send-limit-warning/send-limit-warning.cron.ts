import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

const WARNING_THRESHOLD = 80;

type MetricKind = 'EMPLOYEES' | 'BRANCHES' | 'BOOKINGS' | 'CLIENTS';

interface MetricCheck {
  kind: MetricKind;
  limitKey: string;
  getUsed: (organizationId: string, periodStart: Date) => Promise<number | null>;
  formatBody: (used: number, max: number) => string;
}

interface SubscriptionWithPlan {
  id: string;
  organizationId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  plan: { limits: unknown };
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

    const metrics: MetricCheck[] = [
      {
        kind: 'EMPLOYEES',
        limitKey: 'maxEmployees',
        getUsed: async (orgId) => {
          const count = await this.prisma.$allTenants.employee.count({
            where: { organizationId: orgId, isActive: true },
          });
          return count;
        },
        formatBody: (used, max) => `Active employees are at ${used}/${max} for this plan.`,
      },
      {
        kind: 'BRANCHES',
        limitKey: 'maxBranches',
        getUsed: async (orgId) => {
          const count = await this.prisma.$allTenants.branch.count({
            where: { organizationId: orgId, isActive: true },
          });
          return count;
        },
        formatBody: (used, max) => `Active branches are at ${used}/${max} for this plan.`,
      },
      {
        kind: 'BOOKINGS',
        limitKey: 'maxBookingsPerMonth',
        getUsed: async (orgId, periodStart) => {
          const counter = await this.prisma.$allTenants.usageCounter.findFirst({
            where: { organizationId: orgId, featureKey: 'BOOKINGS_PER_MONTH', periodStart },
          });
          return counter?.value ?? 0;
        },
        formatBody: (used, max) => `Monthly bookings are at ${used}/${max} for this plan.`,
      },
      {
        kind: 'CLIENTS',
        limitKey: 'maxClients',
        getUsed: async (orgId) => {
          const count = await this.prisma.$allTenants.client.count({
            where: { organizationId: orgId },
          });
          return count;
        },
        formatBody: (used, max) => `Clients are at ${used}/${max} for this plan.`,
      },
    ];

    let sent = 0;

    for (const sub of subscriptions as SubscriptionWithPlan[]) {
      const owner = await this.prisma.$allTenants.membership.findFirst({
        where: { organizationId: sub.organizationId, role: 'OWNER', isActive: true },
        include: { user: { select: { name: true } } },
      });
      if (!owner) continue;

      for (const metric of metrics) {
        const max = this.readLimit(sub.plan.limits, metric.limitKey);
        if (max === null) continue;

        const used = await metric.getUsed(sub.organizationId, sub.currentPeriodStart);
        if (used === null) continue;
        if (used < Math.ceil(max * (WARNING_THRESHOLD / 100))) continue;

        const existing = await this.prisma.$allTenants.notification.findFirst({
          where: {
            organizationId: sub.organizationId,
            recipientId: owner.userId,
            type: 'GENERAL',
            createdAt: { gte: sub.currentPeriodStart, lt: sub.currentPeriodEnd },
            AND: [
              { metadata: { path: ['kind'], equals: metric.kind } },
              { metadata: { path: ['threshold'], equals: WARNING_THRESHOLD } },
            ],
          },
        });
        if (existing) continue;

        await this.prisma.$allTenants.notification.create({
          data: {
            organizationId: sub.organizationId,
            recipientId: owner.userId,
            recipientType: 'EMPLOYEE',
            type: 'GENERAL',
            title: 'Usage limit warning',
            body: metric.formatBody(used, max),
            metadata: {
              kind: metric.kind,
              threshold: WARNING_THRESHOLD,
            } satisfies Prisma.InputJsonObject,
          },
        });
        sent += 1;
      }
    }

    if (sent > 0) {
      this.logger.log(`Sent ${sent} usage limit warning notifications`);
    }
  }

  private readLimit(limits: unknown, key: string): number | null {
    if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return null;
    const val = (limits as Record<string, unknown>)[key];
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return null;
    return val;
  }
}
