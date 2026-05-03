import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { SubscriptionStateMachine } from '../subscription-state-machine';
import { PlatformMailerService } from '../../../../infrastructure/mail';
import { ChangePlanDto } from '../dto/change-plan.dto';
import { MoyasarSubscriptionClient } from '../../../finance/moyasar-api/moyasar-subscription.client';
import { computeProrationAmountSar } from '../compute-proration/proration-calculator';
import { priceMonthlyEquivalentSar } from '../compute-proration/compute-proration.handler';
import { EventBusService } from '../../../../infrastructure/events';
import {
  SUBSCRIPTION_UPDATED_EVENT,
  type SubscriptionUpdatedPayload,
} from '../events/subscription-updated.event';

@Injectable()
export class UpgradePlanHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly stateMachine: SubscriptionStateMachine,
    private readonly mailer: PlatformMailerService,
    private readonly moyasar: MoyasarSubscriptionClient,
    private readonly config: ConfigService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: ChangePlanDto) {
    const organizationId = this.tenant.requireOrganizationId();

    const sub = await this.prisma.subscription.findFirst({
      where: { organizationId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        billingCycle: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        scheduledPlanId: true,
        scheduledBillingCycle: true,
        scheduledPlanChangeAt: true,
        moyasarCardTokenRef: true,
        defaultSavedCard: { select: { id: true, moyasarTokenId: true } },
        plan: {
          select: {
            id: true,
            nameAr: true,
            priceMonthly: true,
            priceAnnual: true,
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('No active subscription');
    if (sub.status === 'CANCELED' || sub.status === 'SUSPENDED') {
      throw new BadRequestException(`Cannot upgrade a ${sub.status} subscription`);
    }

    const targetPlan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, isActive: true },
      select: {
        id: true,
        nameAr: true,
        priceMonthly: true,
        priceAnnual: true,
      },
    });
    if (!targetPlan) throw new NotFoundException('Target plan not found');

    if (sub.status === 'TRIALING') {
      const updated = await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          planId: targetPlan.id,
          billingCycle: dto.billingCycle,
          cancelAtPeriodEnd: false,
          scheduledCancellationDate: null,
          scheduledPlanId: null,
          scheduledBillingCycle: null,
          scheduledPlanChangeAt: null,
          updatedAt: new Date(Date.now()),
        },
      });
      this.cache.invalidate(organizationId);

      await this.emitSubscriptionUpdated(organizationId, sub.id, 'UPGRADE');

      const owner = await this.prisma.membership.findFirst({
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

    const currentMonthlySar = priceMonthlyEquivalentSar(sub.plan, sub.billingCycle);
    const targetMonthlySar = priceMonthlyEquivalentSar(targetPlan, dto.billingCycle);
    if (Number(targetMonthlySar) <= Number(currentMonthlySar)) {
      throw new BadRequestException('Target plan is not an upgrade');
    }

    const proration = computeProrationAmountSar({
      currentPriceSar: currentMonthlySar,
      targetPriceSar: targetMonthlySar,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      now: new Date(Date.now()),
    });
    if (proration.amountHalalas <= 0) {
      // Upgrade is valid but proration rounds to zero (e.g. near period end).
      // Apply the plan change immediately without charging.
      const updated = await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          planId: targetPlan.id,
          billingCycle: dto.billingCycle,
          cancelAtPeriodEnd: false,
          scheduledCancellationDate: null,
          scheduledPlanId: null,
          scheduledBillingCycle: null,
          scheduledPlanChangeAt: null,
          updatedAt: new Date(Date.now()),
        },
      });
      this.cache.invalidate(organizationId);
      await this.emitSubscriptionUpdated(organizationId, sub.id, 'UPGRADE');

      const owner = await this.prisma.membership.findFirst({
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

    const token = sub.defaultSavedCard?.moyasarTokenId ?? sub.moyasarCardTokenRef;
    if (!token) {
      throw new UnprocessableEntityException('billing_default_card_required');
    }

    // Fire upgrade event through state machine (stays ACTIVE)
    this.stateMachine.transition(sub.status, { type: 'upgrade' });

    const invoice = await this.prisma.subscriptionInvoice.create({
      data: {
        subscriptionId: sub.id,
        organizationId,
        amount: proration.amountSar,
        flatAmount: '0.00',
        overageAmount: '0.00',
        lineItems: [
          {
            kind: 'PRORATION',
            fromPlanId: sub.plan.id,
            toPlanId: targetPlan.id,
            amount: proration.amountSar,
            amountHalalas: proration.amountHalalas,
            remainingRatio: proration.remainingRatio,
          },
        ],
        status: 'DUE',
        billingCycle: dto.billingCycle,
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
        dueDate: new Date(Date.now()),
        issuedAt: new Date(Date.now()),
      },
    });
    const idempotencyKey = `subscription-proration:${invoice.id}`;
    const payment = await this.moyasar.chargeWithToken({
      token,
      amount: proration.amountHalalas,
      currency: 'SAR',
      idempotencyKey,
      givenId: idempotencyKey,
      description: `Deqah subscription proration invoice ${invoice.id}`,
      callbackUrl: this.billingCallbackUrl(),
    });
    if (payment.status.toLowerCase() !== 'paid') {
      await this.prisma.subscriptionInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'FAILED',
          moyasarPaymentId: payment.id,
          failureReason: `Moyasar returned status ${payment.status}`,
        },
      });
      throw new UnprocessableEntityException('billing_proration_payment_requires_retry');
    }

    await this.prisma.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        paidAt: new Date(Date.now()),
        moyasarPaymentId: payment.id,
      },
    });

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId: targetPlan.id,
        billingCycle: dto.billingCycle,
        cancelAtPeriodEnd: false,
        scheduledCancellationDate: null,
        scheduledPlanId: null,
        scheduledBillingCycle: null,
        scheduledPlanChangeAt: null,
        updatedAt: new Date(Date.now()),
      },
    });
    this.cache.invalidate(organizationId);

    await this.emitSubscriptionUpdated(organizationId, sub.id, 'UPGRADE');

    const owner = await this.prisma.membership.findFirst({
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

  private async emitSubscriptionUpdated(
    organizationId: string,
    subscriptionId: string,
    reason: SubscriptionUpdatedPayload['reason'],
  ): Promise<void> {
    await this.eventBus
      .publish<SubscriptionUpdatedPayload>(SUBSCRIPTION_UPDATED_EVENT, {
        eventId: `${SUBSCRIPTION_UPDATED_EVENT}:${subscriptionId}:${Date.now()}`,
        source: 'billing.upgrade-plan',
        version: 1,
        occurredAt: new Date(),
        payload: { organizationId, subscriptionId, reason },
      })
      .catch(() => undefined); // fire-and-forget; do not block response
  }

  private billingCallbackUrl(): string {
    const base =
      this.config.get<string>('BACKEND_URL') ??
      this.config.get<string>('DASHBOARD_PUBLIC_URL', '');
    return `${base.replace(/\/+$/, '')}/api/v1/public/billing/webhooks/moyasar`;
  }
}


