import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../../infrastructure/database';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../../common/tenant/tenant.constants';
import { PlatformMailerService } from '../../../../infrastructure/mail/platform-mailer.service';

/**
 * Daily digest. Schedule via apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts
 * by adding ORGS_WITHOUT_OWNER to CRON_JOBS and a dispatch entry.
 *
 * Detects organizations whose only OWNER membership has been deactivated
 * (a state the deactivate-user guard now prevents going forward, but
 * historical orgs may already be orphaned). Emails the platform ops alias.
 */
@Injectable()
export class OrgsWithoutOwnerCron {
  private readonly logger = new Logger(OrgsWithoutOwnerCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: PlatformMailerService,
    private readonly cls: ClsService,
    private readonly config: ConfigService,
  ) {}

  async execute(): Promise<void> {
    await this.cls.run(async () => {
      this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      this.logger.log('systemContext: orgs-without-owner digest tick');

      const orphans = await this.prisma.$allTenants.organization.findMany({
        where: {
          memberships: { none: { role: 'OWNER', isActive: true } },
        },
        select: { id: true, nameAr: true, nameEn: true },
      });

      if (orphans.length === 0) {
        this.logger.log('No orphan organizations detected');
        return;
      }

      const recipient =
        this.config.get<string>('PLATFORM_OPS_EMAIL') ??
        this.config.get<string>('RESEND_REPLY_TO');
      if (!recipient) {
        this.logger.warn(
          `Detected ${orphans.length} orphan orgs but no PLATFORM_OPS_EMAIL configured`,
        );
        return;
      }

      const adminPanelUrl =
        this.config.get<string>('PLATFORM_ADMIN_URL') ?? 'https://admin.deqah.test';

      await this.mailer.sendOrphanOrgsDigest(recipient, {
        recipientName: 'Ops',
        orphans,
        adminPanelUrl,
        generatedAt: new Date(),
      });

      this.logger.warn(`Sent orphan-orgs digest for ${orphans.length} organizations`);
    });
  }
}
