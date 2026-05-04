import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { StartSubscriptionDto } from '../dto/start-subscription.dto';
import { EventBusService } from '../../../../infrastructure/events';
import {
  SUBSCRIPTION_UPDATED_EVENT,
  type SubscriptionUpdatedPayload,
} from '../events/subscription-updated.event';
import { LaunchFlags } from '../feature-flags/launch-flags';

@Injectable()
export class StartSubscriptionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly config: ConfigService,
    private readonly eventBus: EventBusService,
    private readonly flags: LaunchFlags,
  ) {}

  async execute(dto: StartSubscriptionDto) {
    const organizationId = this.tenant.requireOrganizationId();

    const existing = await this.prisma.subscription.findFirst({ where: { organizationId } });
    if (existing) throw new ConflictException('Organization already has a subscription');

    const plan = await this.prisma.plan.findFirst({ where: { id: dto.planId, isActive: true } });
    if (!plan) throw new NotFoundException('Plan not found');

    let planVersionId: string | undefined;
    if (this.flags.planVersioningEnabled) {
      const latest = await this.prisma.planVersion.findFirst({
        where: { planId: plan.id },
        orderBy: { version: 'desc' },
        select: { id: true },
      });
      planVersionId = latest?.id;
    }

    const trialDays = this.config.get<number>('SAAS_TRIAL_DAYS', 14);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + trialDays * 86_400_000);
    const periodEnd =
      dto.billingCycle === 'ANNUAL'
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const sub = await this.prisma.subscription.create({
      data: {
        organizationId,
        planId: plan.id,
        planVersionId: planVersionId ?? null,
        status: 'TRIALING',
        billingCycle: dto.billingCycle,
        trialStartedAt: now,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        moyasarCardTokenRef: dto.moyasarCardTokenRef ?? null,
      },
    });

    this.cache.invalidate(organizationId);

    await this.eventBus
      .publish<SubscriptionUpdatedPayload>(SUBSCRIPTION_UPDATED_EVENT, {
        eventId: `${SUBSCRIPTION_UPDATED_EVENT}:${sub.id}:${Date.now()}`,
        source: 'billing.start-subscription',
        version: 1,
        occurredAt: new Date(),
        payload: { organizationId, subscriptionId: sub.id, reason: 'START' },
      })
      .catch(() => undefined);

    return sub;
  }
}
