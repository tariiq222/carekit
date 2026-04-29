import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import {
  SYSTEM_CONTEXT_CLS_KEY,
  TENANT_CLS_KEY,
} from '../../../common/tenant/tenant.constants';
import { GetBookingSettingsHandler } from '../../bookings/get-booking-settings/get-booking-settings.handler';

@Injectable()
export class BookingAutocompleteCron {
  private readonly logger = new Logger(BookingAutocompleteCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly cls: ClsService,
  ) {}

  /**
   * Auto-complete confirmed bookings per organization. Runs without a tenant
   * context, so Stage 1 lists active orgs in system context, then Stage 2
   * iterates and runs the per-org work inside that org's tenant CLS so
   * BookingSettings + Booking queries scope correctly under strict mode.
   */
  async execute(): Promise<void> {
    const orgIds = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      const orgs = await this.prisma.organization.findMany({
        where: { suspendedAt: null },
        select: { id: true },
      });
      return orgs.map((o) => o.id);
    });

    let totalCompleted = 0;
    for (const organizationId of orgIds) {
      try {
        const completed = await this.runForOrg(organizationId);
        totalCompleted += completed;
      } catch (err) {
        // Don't let one tenant's failure halt the whole run.
        this.logger.error(
          `autocomplete failed for org ${organizationId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    if (totalCompleted > 0) {
      this.logger.log(
        `completed ${totalCompleted} bookings across ${orgIds.length} orgs`,
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

      const settings = await this.settingsHandler.execute({ branchId: null });
      const cutoff = new Date(
        Date.now() - settings.autoCompleteAfterHours * 3_600_000,
      );

      const result = await this.prisma.booking.updateMany({
        where: {
          status: BookingStatus.CONFIRMED,
          endsAt: { lte: cutoff },
        },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      return result.count;
    });
  }
}
