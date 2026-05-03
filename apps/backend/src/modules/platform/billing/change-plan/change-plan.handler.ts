import { Injectable, NotFoundException } from '@nestjs/common';
import { BillingCycle } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { ChangePlanDto } from '../dto/change-plan.dto';
import { UpgradePlanHandler } from '../upgrade-plan/upgrade-plan.handler';
import { ScheduleDowngradeHandler } from '../schedule-downgrade/schedule-downgrade.handler';
import { StartSubscriptionHandler } from '../start-subscription/start-subscription.handler';

@Injectable()
export class ChangePlanHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly upgrade: UpgradePlanHandler,
    private readonly scheduleDowngrade: ScheduleDowngradeHandler,
    private readonly startSub: StartSubscriptionHandler,
  ) {}

  async execute(dto: ChangePlanDto) {
    const organizationId = this.tenant.requireOrganizationId();

    const sub = await this.prisma.subscription.findFirst({
      where: { organizationId },
      select: {
        status: true,
        billingCycle: true,
        plan: { select: { priceMonthly: true, priceAnnual: true } },
      },
    });
    if (!sub) throw new NotFoundException('No active subscription');

    if (sub.status === 'CANCELED') {
      return this.startSub.execute({ planId: dto.planId, billingCycle: dto.billingCycle });
    }

    const targetPlan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, isActive: true },
      select: { priceMonthly: true, priceAnnual: true },
    });
    if (!targetPlan) throw new NotFoundException('Target plan not found');

    const currentPrice = priceForCycle(sub.plan, sub.billingCycle);
    const targetPrice = priceForCycle(targetPlan, dto.billingCycle);

    if (targetPrice > currentPrice) {
      return this.upgrade.execute(dto);
    }
    return this.scheduleDowngrade.execute(dto);
  }
}

function priceForCycle(
  plan: { priceMonthly: { toString(): string }; priceAnnual: { toString(): string } },
  billingCycle: BillingCycle,
) {
  const price = billingCycle === 'ANNUAL' ? plan.priceAnnual : plan.priceMonthly;
  return Number(price.toString());
}
