import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { PlatformMailerService } from '../../../../infrastructure/mail';
import { MoyasarSubscriptionClient } from '../../../finance/moyasar-api/moyasar-subscription.client';
import { RecordSubscriptionPaymentHandler } from '../record-subscription-payment/record-subscription-payment.handler';
import { SubscriptionCacheService } from '../subscription-cache.service';

export const DUNNING_MAX_RETRIES = 4;
export const DUNNING_RETRY_DELAYS_MS = [
  3 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
] as const;

interface DunningSubscription {
  id: string;
  organizationId: string;
  dunningRetryCount: number;
}

interface DunningInvoice {
  id: string;
  amount: unknown;
}

export interface RetryInvoiceCommand {
  subscription: DunningSubscription;
  invoice: DunningInvoice;
  now: Date;
  manual: boolean;
}

export interface RetryInvoiceResult {
  ok: boolean;
  status: 'PAID' | 'FAILED' | 'DUPLICATE_ATTEMPT';
  attemptNumber: number;
}

@Injectable()
export class DunningRetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasar: MoyasarSubscriptionClient,
    private readonly recordPayment: RecordSubscriptionPaymentHandler,
    private readonly cache: SubscriptionCacheService,
    private readonly config: ConfigService,
    private readonly mailer: PlatformMailerService,
  ) {}

  async retryInvoice(cmd: RetryInvoiceCommand): Promise<RetryInvoiceResult> {
    const attemptNumber = cmd.subscription.dunningRetryCount + 1;
    const log = await this.createAttemptLog(cmd, attemptNumber);
    if (!log) {
      return { ok: false, status: 'DUPLICATE_ATTEMPT', attemptNumber };
    }

    const card = await this.prisma.savedCard.findFirst({
      where: { organizationId: cmd.subscription.organizationId, isDefault: true },
      select: { id: true, moyasarTokenId: true },
    });

    if (!card) {
      await this.recordFailure({
        ...cmd,
        attemptNumber,
        logId: log.id,
        moyasarPaymentId: null,
        reason: 'No default saved card',
      });
      return { ok: false, status: 'FAILED', attemptNumber };
    }

    try {
      const idempotencyKey = `dunning:${cmd.invoice.id}:${attemptNumber}`;
      const payment = await this.moyasar.chargeWithToken({
        token: card.moyasarTokenId,
        amount: Math.round(Number(cmd.invoice.amount) * 100),
        currency: 'SAR',
        idempotencyKey,
        givenId: idempotencyKey,
        description: `Deqah dunning retry ${attemptNumber} for invoice ${cmd.invoice.id}`,
        callbackUrl: this.billingCallbackUrl(),
      });

      if (payment.status.toLowerCase() === 'paid') {
        await this.prisma.dunningLog.update({
          where: { id: log.id },
          data: {
            status: 'PAID',
            moyasarPaymentId: payment.id,
            failureReason: null,
            executedAt: cmd.now,
          },
        });
        await this.recordPayment.execute({
          invoiceId: cmd.invoice.id,
          moyasarPaymentId: payment.id,
        });
        await this.prisma.subscription.update({
          where: { id: cmd.subscription.id },
          data: {
            organizationId: cmd.subscription.organizationId,
            dunningRetryCount: 0,
            nextRetryAt: null,
            lastFailureReason: null,
          },
        });
        this.cache.invalidate(cmd.subscription.organizationId);
        return { ok: true, status: 'PAID', attemptNumber };
      }

      await this.recordFailure({
        ...cmd,
        attemptNumber,
        logId: log.id,
        moyasarPaymentId: payment.id,
        reason: `Moyasar returned status ${payment.status}`,
      });
      return { ok: false, status: 'FAILED', attemptNumber };
    } catch (error) {
      await this.recordFailure({
        ...cmd,
        attemptNumber,
        logId: log.id,
        moyasarPaymentId: null,
        reason: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, status: 'FAILED', attemptNumber };
    }
  }

  private async createAttemptLog(
    cmd: RetryInvoiceCommand,
    attemptNumber: number,
  ): Promise<{ id: string } | null> {
    try {
      return await this.prisma.dunningLog.create({
        data: {
          organizationId: cmd.subscription.organizationId,
          subscriptionId: cmd.subscription.id,
          invoiceId: cmd.invoice.id,
          attemptNumber,
          status: 'PROCESSING',
          scheduledFor: cmd.now,
          executedAt: cmd.now,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) return null;
      throw error;
    }
  }

  private async recordFailure(params: RetryInvoiceCommand & {
    attemptNumber: number;
    logId: string;
    moyasarPaymentId: string | null;
    reason: string;
  }): Promise<void> {
    await this.prisma.dunningLog.update({
      where: { id: params.logId },
      data: {
        status: 'FAILED',
        moyasarPaymentId: params.moyasarPaymentId,
        failureReason: params.reason,
        executedAt: params.now,
      },
    });
    await this.sendFailureEmail(params).catch(() => undefined);

    if (params.attemptNumber >= DUNNING_MAX_RETRIES) {
      await this.prisma.subscription.update({
        where: { id: params.subscription.id },
        data: {
          organizationId: params.subscription.organizationId,
          status: 'SUSPENDED',
          dunningRetryCount: params.attemptNumber,
          nextRetryAt: null,
          lastFailureReason: params.reason,
        },
      });
      this.cache.invalidate(params.subscription.organizationId);
      return;
    }

    await this.prisma.subscription.update({
      where: { id: params.subscription.id },
      data: {
        organizationId: params.subscription.organizationId,
        dunningRetryCount: params.attemptNumber,
        nextRetryAt: new Date(
          params.now.getTime() + DUNNING_RETRY_DELAYS_MS[params.attemptNumber],
        ),
        lastFailureReason: params.reason,
      },
    });
    this.cache.invalidate(params.subscription.organizationId);
  }

  private billingCallbackUrl(): string {
    const base =
      this.config.get<string>('BACKEND_URL') ??
      this.config.get<string>('DASHBOARD_PUBLIC_URL', '');
    return `${base.replace(/\/+$/, '')}/api/v1/public/billing/webhooks/moyasar`;
  }

  private async sendFailureEmail(params: RetryInvoiceCommand & {
    attemptNumber: number;
    reason: string;
  }): Promise<void> {
    const owner = await this.prisma.$allTenants.membership.findFirst({
      where: {
        organizationId: params.subscription.organizationId,
        role: 'OWNER',
        isActive: true,
      },
      select: {
        displayName: true,
        user: { select: { email: true, name: true } },
        organization: { select: { nameAr: true } },
      },
    });
    if (!owner?.user) return;

    const baseUrl = this.config.get<string>(
      'PLATFORM_DASHBOARD_URL',
      'https://app.webvue.pro/dashboard',
    );
    try {
      await this.mailer.sendDunningRetry(owner.user.email, {
        ownerName: owner.displayName ?? owner.user.name ?? '',
        orgName: owner.organization.nameAr,
        amountSar: Number(params.invoice.amount).toFixed(2),
        attemptNumber: params.attemptNumber,
        maxAttempts: DUNNING_MAX_RETRIES,
        reason: params.reason,
        billingUrl: `${baseUrl.replace(/\/+$/, '')}/settings/billing`,
      });
    } catch {
      // Dunning state must not depend on best-effort email delivery.
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
