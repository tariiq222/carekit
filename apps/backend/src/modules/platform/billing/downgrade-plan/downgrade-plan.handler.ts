import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { SubscriptionStateMachine } from '../subscription-state-machine';
import { PlatformMailerService } from '../../../../infrastructure/mail';
import { ChangePlanDto } from '../dto/change-plan.dto';
import { EventBusService } from '../../../../infrastructure/events';
import {
  SUBSCRIPTION_UPDATED_EVENT,
  type SubscriptionUpdatedPayload,
} from '../events/subscription-updated.event';
import { DowngradeSafetyService } from '../downgrade-safety/downgrade-safety.service';
import { DowngradePrecheckFailedException } from '../downgrade-safety/downgrade-precheck.exception';

@Injectable()
export class DowngradePlanHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly stateMachine: SubscriptionStateMachine,
    private readonly mailer: PlatformMailerService,
    private readonly config: ConfigService,
    private readonly eventBus: EventBusService,
    private readonly downgradeSafety: DowngradeSafetyService,
  ) {}

  async execute(dto: ChangePlanDto) {
    const organizationId = this.tenant.requireOrganizationId();

    const sub = await this.prisma.subscription.findFirst({
      where: { organizationId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('No active subscription');
    if (sub.status === 'CANCELED' || sub.status === 'SUSPENDED') {
      throw new BadRequestException(`Cannot downgrade a ${sub.status} subscription`);
    }

    const targetPlan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, isActive: true },
    });
    if (!targetPlan) throw new NotFoundException('Target plan not found');
    if (Number(targetPlan.priceMonthly) >= Number(sub.plan.priceMonthly)) {
      throw new BadRequestException('Target plan is not a downgrade');
    }

    // Bug B8 — block downgrade if current usage exceeds target plan limits.
    const safety = await this.downgradeSafety.checkDowngrade(
      sub.plan,
      targetPlan,
      organizationId,
    );
    if (!safety.ok) {
      throw new DowngradePrecheckFailedException(safety.violations);
    }

    // Fire downgrade event through state machine (stays ACTIVE)
    this.stateMachine.transition(sub.status, { type: 'downgrade' });

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { planId: targetPlan.id, billingCycle: dto.billingCycle, updatedAt: new Date() },
    });
    this.cache.invalidate(organizationId);

    await this.eventBus
      .publish<SubscriptionUpdatedPayload>(SUBSCRIPTION_UPDATED_EVENT, {
        eventId: `${SUBSCRIPTION_UPDATED_EVENT}:${sub.id}:${Date.now()}`,
        source: 'billing.downgrade-plan',
        version: 1,
        occurredAt: new Date(),
        payload: { organizationId, subscriptionId: sub.id, reason: 'DOWNGRADE' },
      })
      .catch(() => undefined);

    const owner = await this.prisma.$allTenants.membership.findFirst({
      where: { organizationId, role: 'OWNER', isActive: true },
      select: {
        displayName: true,
        user: { select: { email: true, name: true } },
        organization: { select: { nameAr: true } },
      },
    });
    if (owner?.user) {
      await this.mailer.sendPlanChanged(owner.user.email, {
        ownerName: owner.displayName ?? owner.user.name ?? '',
        orgName: owner.organization.nameAr,
        fromPlanName: sub.plan.nameAr,
        toPlanName: targetPlan.nameAr,
        effectiveDate: new Date().toISOString(),
      });
    }

    return updated;
  }
}
