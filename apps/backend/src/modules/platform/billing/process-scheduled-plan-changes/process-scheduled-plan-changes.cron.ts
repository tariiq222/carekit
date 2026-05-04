import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { DowngradeSafetyService } from '../downgrade-safety/downgrade-safety.service';

@Injectable()
export class ProcessScheduledPlanChangesCron {
  private readonly logger = new Logger(ProcessScheduledPlanChangesCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: SubscriptionCacheService,
    private readonly downgradeSafety: DowngradeSafetyService,
  ) {}

  async execute(): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    const now = new Date();
    const due = await this.prisma.$allTenants.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        scheduledPlanId: { not: null },
        scheduledBillingCycle: { not: null },
        scheduledPlanChangeAt: { lte: now },
      },
      select: {
        id: true,
        organizationId: true,
        scheduledPlanId: true,
        scheduledBillingCycle: true,
        plan: { select: { priceMonthly: true, limits: true } },
        scheduledPlan: { select: { priceMonthly: true, limits: true } },
      },
    });

    let blocked = 0;

    for (const sub of due) {
      if (!sub.scheduledPlanId || !sub.scheduledBillingCycle || !sub.scheduledPlan) {
        continue;
      }

      // Bug B8 — only re-check downgrades. If the scheduled plan is priced
      // higher than (or equal to) the current plan it's an upgrade or sidegrade
      // and is always safe.
      const isDowngrade =
        Number(sub.scheduledPlan.priceMonthly) < Number(sub.plan.priceMonthly);

      if (isDowngrade) {
        const safety = await this.downgradeSafety.checkDowngrade(
          sub.plan,
          sub.scheduledPlan,
          sub.organizationId,
        );
        if (!safety.ok) {
          await this.prisma.$allTenants.subscription.update({
            where: { id: sub.id },
            data: {
              scheduledChangeBlockedReason: 'BLOCKED_BY_USAGE',
            },
          });
          this.cache.invalidate(sub.organizationId);
          blocked += 1;
          this.logger.warn(
            `Blocked scheduled downgrade for org=${sub.organizationId} sub=${sub.id}: ${JSON.stringify(safety.violations)}`,
          );
          continue;
        }
      }

      await this.prisma.$allTenants.subscription.update({
        where: { id: sub.id },
        data: {
          planId: sub.scheduledPlanId,
          billingCycle: sub.scheduledBillingCycle,
          scheduledPlanId: null,
          scheduledBillingCycle: null,
          scheduledPlanChangeAt: null,
          scheduledChangeBlockedReason: null,
        },
      });
      this.cache.invalidate(sub.organizationId);

      // Write grace columns for features removed by this downgrade swap.
      if (isDowngrade) {
        const oldLimits = (sub.plan.limits ?? {}) as Record<string, unknown>;
        const newLimits = (sub.scheduledPlan.limits ?? {}) as Record<string, unknown>;

        const graceUpdates: Prisma.SubscriptionUpdateInput = {};
        if (oldLimits['api_access'] === true && newLimits['api_access'] !== true) {
          graceUpdates.apiAccessGraceUntil = new Date(Date.now() + 7 * 86_400_000);
        }
        if (oldLimits['webhooks'] === true && newLimits['webhooks'] !== true) {
          graceUpdates.webhooksGraceUntil = new Date(Date.now() + 7 * 86_400_000);
        }
        if (Object.keys(graceUpdates).length > 0) {
          await this.prisma.$allTenants.subscription.update({
            where: { id: sub.id },
            data: graceUpdates,
          });
        }

        if (oldLimits['custom_domain'] === true && newLimits['custom_domain'] !== true) {
          const settings = await this.prisma.$allTenants.organizationSettings.findFirst({
            where: { organizationId: sub.organizationId },
            select: { customDomain: true },
          });
          if (settings?.customDomain) {
            await this.prisma.$allTenants.organizationSettings.updateMany({
              where: { organizationId: sub.organizationId },
              data: { customDomainGraceUntil: new Date(Date.now() + 30 * 86_400_000) },
            });
          }
        }
      }
    }

    if (due.length > 0) {
      this.logger.log(
        `Processed ${due.length - blocked} scheduled plan changes (blocked=${blocked})`,
      );
    }
  }
}
