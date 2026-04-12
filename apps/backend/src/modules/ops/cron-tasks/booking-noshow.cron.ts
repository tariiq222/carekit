import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../../bookings/get-booking-settings/get-booking-settings.handler';

@Injectable()
export class BookingNoShowCron {
  private readonly logger = new Logger(BookingNoShowCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  /**
   * Mark CONFIRMED bookings as NO_SHOW per tenant using each tenant's autoNoShowAfterMinutes setting.
   */
  async execute(): Promise<void> {
    const tenantIds = await this.prisma.booking
      .findMany({
        where: { status: BookingStatus.CONFIRMED },
        select: { tenantId: true },
        distinct: ['tenantId'],
      })
      .then((rows) => rows.map((r) => r.tenantId));

    let totalNoShow = 0;

    for (const tenantId of tenantIds) {
      // Use tenant-global settings for cron jobs — branch-level overrides apply to user-facing flows only.
      const settings = await this.settingsHandler.execute({ tenantId, branchId: null });
      const cutoff = new Date(Date.now() - settings.autoNoShowAfterMinutes * 60_000);

      const result = await this.prisma.booking.updateMany({
        where: {
          tenantId,
          status: BookingStatus.CONFIRMED,
          scheduledAt: { lte: cutoff },
          checkedInAt: null,
        },
        data: {
          status: BookingStatus.NO_SHOW,
          noShowAt: new Date(),
        },
      });
      totalNoShow += result.count;
    }

    if (totalNoShow > 0) {
      this.logger.log(`marked ${totalNoShow} as NO_SHOW`);
    }
  }
}
