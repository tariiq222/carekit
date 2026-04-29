import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { SubscriptionStateMachine } from '../subscription-state-machine';
import { PlatformMailerService } from '../../../../infrastructure/mail';
import { ChangePlanDto } from '../dto/change-plan.dto';

@Injectable()
export class DowngradePlanHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly stateMachine: SubscriptionStateMachine,
    private readonly mailer: PlatformMailerService,
    private readonly config: ConfigService,
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

    // Fire downgrade event through state machine (stays ACTIVE)
    this.stateMachine.transition(sub.status, { type: 'downgrade' });

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { planId: targetPlan.id, billingCycle: dto.billingCycle, updatedAt: new Date() },
    });
    this.cache.invalidate(organizationId);

    const owner = await this.prisma.$allTenants.membership.findFirst({
      where: { organizationId, role: 'OWNER', isActive: true },
      include: {
        user: { select: { email: true, name: true } },
        organization: { select: { nameAr: true } },
      },
    });
    if (owner?.user) {
      await this.mailer.sendPlanChanged(owner.user.email, {
        ownerName: owner.user.name ?? '',
        orgName: owner.organization.nameAr,
        fromPlanName: sub.plan.nameAr,
        toPlanName: targetPlan.nameAr,
        effectiveDate: new Date().toISOString(),
      });
    }

    return updated;
  }
}
