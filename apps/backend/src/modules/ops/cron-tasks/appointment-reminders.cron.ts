import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { WaitlistStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import {
  SYSTEM_CONTEXT_CLS_KEY,
  TENANT_CLS_KEY,
} from '../../../common/tenant/tenant.constants';

/**
 * Stub. The real reminder pipeline (T-24h / T-1h / T-15m fan-out via comms
 * channels — push, SMS, email) is not yet implemented. Until then this cron
 * runs a per-org sanity sweep over WAITING waitlist entries so the cron is
 * tenant-safe under strict mode and there is one place to wire the dispatch
 * once the comms pipeline is ready.
 *
 * Tracking: implement reminder dispatch via NotificationChannelRegistry +
 * BookingSettings.reminderHours[] (new field) + ReminderLedger.
 */
@Injectable()
export class AppointmentRemindersCron {
  private readonly logger = new Logger(AppointmentRemindersCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async execute(): Promise<void> {
    const orgIds = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      const orgs = await this.prisma.organization.findMany({
        where: { suspendedAt: null },
        select: { id: true },
      });
      return orgs.map((o) => o.id);
    });

    let totalChecked = 0;
    for (const organizationId of orgIds) {
      try {
        totalChecked += await this.runForOrg(organizationId);
      } catch (err) {
        this.logger.error(
          `appointment-reminders sweep failed for org ${organizationId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    if (totalChecked > 0) {
      this.logger.log(
        `${totalChecked} waitlist entries checked across ${orgIds.length} orgs (reminders pipeline not yet implemented)`,
      );
    }
  }

  private async runForOrg(organizationId: string): Promise<number> {
    return this.cls.run(async () => {
      this.cls.set(TENANT_CLS_KEY, {
        organizationId,
        membershipId: '',
        id: '',
        role: 'CRON',
        isSuperAdmin: false,
      });

      const waiting = await this.prisma.waitlistEntry.findMany({
        where: { status: WaitlistStatus.WAITING },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      // TODO: dispatch reminders here once the pipeline lands.
      return waiting.length;
    });
  }
}
