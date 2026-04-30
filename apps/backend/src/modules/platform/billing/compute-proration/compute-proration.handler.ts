import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingCycle } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { ProrationPreviewDto } from '../dto/change-plan.dto';
import { computeProrationAmountSar } from './proration-calculator';

type PreviewAction = 'UPGRADE_NOW' | 'SCHEDULE_DOWNGRADE';

@Injectable()
export class ComputeProrationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: ProrationPreviewDto) {
    const organizationId = this.tenant.requireOrganizationId();
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId },
      select: {
        status: true,
        billingCycle: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        plan: {
          select: {
            id: true,
            priceMonthly: true,
            priceAnnual: true,
          },
        },
      },
    });
    if (!subscription) throw new NotFoundException('No active subscription');
    if (subscription.status === 'CANCELED' || subscription.status === 'SUSPENDED') {
      throw new BadRequestException(`Cannot change a ${subscription.status} subscription`);
    }

    const targetPlan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, isActive: true },
      select: { id: true, priceMonthly: true, priceAnnual: true },
    });
    if (!targetPlan) throw new NotFoundException('Target plan not found');

    const now = new Date(Date.now());

    if (subscription.status === 'TRIALING') {
      return {
        action: 'UPGRADE_NOW' as PreviewAction,
        targetPlanId: targetPlan.id,
        billingCycle: dto.billingCycle,
        effectiveAt: now,
        clearsScheduledCancellation: false,
        amountSar: '0.00',
        amountHalalas: 0,
        remainingRatio: 0,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        isUpgrade: false,
        trialChange: true,
      };
    }

    const proration = computeProrationAmountSar({
      currentPriceSar: priceForCycle(subscription.plan, subscription.billingCycle),
      targetPriceSar: priceForCycle(targetPlan, dto.billingCycle),
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      now,
    });
    const action: PreviewAction = proration.isUpgrade ? 'UPGRADE_NOW' : 'SCHEDULE_DOWNGRADE';

    return {
      action,
      targetPlanId: targetPlan.id,
      billingCycle: dto.billingCycle,
      effectiveAt: proration.isUpgrade ? now : subscription.currentPeriodEnd,
      clearsScheduledCancellation: proration.isUpgrade && subscription.cancelAtPeriodEnd,
      ...proration,
    };
  }
}

function priceForCycle(
  plan: { priceMonthly: { toString(): string }; priceAnnual: { toString(): string } },
  billingCycle: BillingCycle,
) {
  return billingCycle === 'ANNUAL'
    ? plan.priceAnnual.toString()
    : plan.priceMonthly.toString();
}
