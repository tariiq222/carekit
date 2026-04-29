import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { PlatformMailerService } from '../../../../infrastructure/mail';

const TRIAL_ENDING_WINDOW_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class ExpireTrialsCron {
  private readonly logger = new Logger(ExpireTrialsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: SubscriptionCacheService,
    private readonly mailer: PlatformMailerService,
  ) {}

  async execute(): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    const now = new Date();
    const upgradeUrl =
      (this.config.get<string>('PLATFORM_DASHBOARD_URL', 'https://app.webvue.pro/dashboard')) +
      '/billing';

    await this.notifyTrialEnding(now, upgradeUrl);
    await this.notifyTrialExpired(now, upgradeUrl);
  }

  private async notifyTrialEnding(now: Date, upgradeUrl: string): Promise<void> {
    const windowEnd = new Date(now.getTime() + TRIAL_ENDING_WINDOW_DAYS * MS_PER_DAY);

    const subs = await this.prisma.$allTenants.subscription.findMany({
      where: {
        status: 'TRIALING',
        notifiedTrialEndingAt: null,
      },
      include: {
        organization: {
          select: { trialEndsAt: true, nameAr: true },
        },
      },
    });

    for (const sub of subs) {
      const trialEndsAt = sub.organization?.trialEndsAt;
      if (!trialEndsAt) continue;
      if (trialEndsAt <= now) continue;
      if (trialEndsAt > windowEnd) continue;

      const owner = await this.lookupOwner(sub.organizationId);
      if (!owner) continue;

      const daysLeft = Math.max(
        1,
        Math.ceil((trialEndsAt.getTime() - now.getTime()) / MS_PER_DAY),
      );

      await this.mailer.sendTrialEnding(owner.email, {
        ownerName: owner.name,
        orgName: sub.organization.nameAr,
        daysLeft,
        upgradeUrl,
      });

      await this.prisma.$allTenants.subscription.update({
        where: { id: sub.id },
        data: { notifiedTrialEndingAt: now },
      });
    }
  }

  private async notifyTrialExpired(now: Date, upgradeUrl: string): Promise<void> {
    const expiredOrgs = await this.prisma.organization.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: { lt: now },
      },
      select: { id: true, nameAr: true },
    });

    if (expiredOrgs.length === 0) return;

    const orgIds = expiredOrgs.map((o) => o.id);

    await this.prisma.organization.updateMany({
      where: { id: { in: orgIds } },
      data: { status: 'PAST_DUE' },
    });

    await this.prisma.subscription.updateMany({
      where: { organizationId: { in: orgIds }, status: 'TRIALING' },
      data: { status: 'PAST_DUE', pastDueSince: now },
    });

    for (const org of expiredOrgs) {
      this.cache.invalidate(org.id);
      const owner = await this.lookupOwner(org.id);
      if (owner) {
        await this.mailer.sendTrialExpired(owner.email, {
          ownerName: owner.name,
          orgName: org.nameAr,
          upgradeUrl,
        });
      }
    }

    this.logger.log(`Transitioned ${orgIds.length} expired trials to PAST_DUE`);
  }

  private async lookupOwner(
    organizationId: string,
  ): Promise<{ email: string; name: string } | null> {
    const membership = await this.prisma.$allTenants.membership.findFirst({
      where: { organizationId, role: 'OWNER', isActive: true },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!membership?.user) return null;
    return { email: membership.user.email, name: membership.user.name ?? '' };
  }
}
