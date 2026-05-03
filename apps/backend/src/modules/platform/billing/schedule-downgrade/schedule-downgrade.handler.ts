import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingCycle } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { ChangePlanDto } from '../dto/change-plan.dto';
import { DowngradeSafetyService } from '../downgrade-safety/downgrade-safety.service';
import { DowngradePrecheckFailedException } from '../downgrade-safety/downgrade-precheck.exception';

@Injectable()
export class ScheduleDowngradeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly downgradeSafety: DowngradeSafetyService,
  ) {}

  async execute(dto: ChangePlanDto) {
    const organizationId = this.tenant.requireOrganizationId();
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId },
      select: {
        id: true,
        status: true,
        billingCycle: true,
        currentPeriodEnd: true,
        plan: {
          select: { priceMonthly: true, priceAnnual: true, limits: true },
        },
      },
    });
    if (!subscription) throw new NotFoundException('No active subscription');
    if (subscription.status === 'CANCELED' || subscription.status === 'SUSPENDED') {
      throw new BadRequestException(`Cannot downgrade a ${subscription.status} subscription`);
    }

    const targetPlan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, isActive: true },
      select: { id: true, priceMonthly: true, priceAnnual: true, limits: true },
    });
    if (!targetPlan) throw new NotFoundException('Target plan not found');
    if (
      priceForCycle(targetPlan, dto.billingCycle) >=
      priceForCycle(subscription.plan, subscription.billingCycle)
    ) {
      throw new BadRequestException('Target plan is not a downgrade');
    }

    // Bug B8 — pre-check at scheduling time. Cron will re-check at swap-time
    // because usage may grow between now and currentPeriodEnd.
    const safety = await this.downgradeSafety.checkDowngrade(
      subscription.plan,
      targetPlan,
      organizationId,
    );
    if (!safety.ok) {
      throw new DowngradePrecheckFailedException(safety.violations);
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        scheduledPlanId: targetPlan.id,
        scheduledBillingCycle: dto.billingCycle,
        scheduledPlanChangeAt: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: false,
        scheduledCancellationDate: null,
        scheduledChangeBlockedReason: null,
      },
    });
    this.cache.invalidate(organizationId);
    return updated;
  }
}

function priceForCycle(
  plan: { priceMonthly: { toString(): string }; priceAnnual: { toString(): string } },
  billingCycle: BillingCycle,
) {
  const price = billingCycle === 'ANNUAL' ? plan.priceAnnual : plan.priceMonthly;
  return Number(price.toString());
}
