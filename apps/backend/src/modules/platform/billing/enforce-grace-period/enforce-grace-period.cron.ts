import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionStateMachine } from '../subscription-state-machine';
import { SubscriptionCacheService } from '../subscription-cache.service';

@Injectable()
export class EnforceGracePeriodCron {
  private readonly logger = new Logger(EnforceGracePeriodCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stateMachine: SubscriptionStateMachine,
    private readonly cache: SubscriptionCacheService,
  ) {}

  async execute(): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    const graceDays = this.config.get<number>('SAAS_GRACE_PERIOD_DAYS', 2);
    const now = new Date();
    const graceMs = graceDays * 24 * 60 * 60 * 1000;

    const overdue = await this.prisma.subscription.findMany({
      where: {
        status: 'PAST_DUE',
        pastDueSince: { lte: new Date(now.getTime() - graceMs) },
      },
    });

    for (const sub of overdue) {
      this.stateMachine.transition(sub.status, { type: 'graceExpired' });

      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          organizationId: sub.organizationId, // explicit — Lesson 8
          status: 'SUSPENDED',
        },
      });

      // Revoke all refresh tokens for this org
      await this.prisma.refreshToken.updateMany({
        where: { organizationId: sub.organizationId },
        data: { revokedAt: now },
      });

      // Also revoke client refresh tokens if model exists
      try {
        await (
          this.prisma as never as {
            clientRefreshToken: {
              updateMany: (args: unknown) => Promise<unknown>;
            };
          }
        ).clientRefreshToken.updateMany({
          where: { organizationId: sub.organizationId },
          data: { revokedAt: now },
        });
      } catch {
        /* model may not exist in all envs */
      }

      this.cache.invalidate(sub.organizationId);
      this.logger.warn(`Subscription ${sub.id} suspended after grace period expired`);
    }

    if (overdue.length > 0) {
      this.logger.log(`Suspended ${overdue.length} subscriptions after grace expiry`);
    }
  }
}
