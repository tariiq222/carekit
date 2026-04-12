import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../../bookings/get-booking-settings/get-booking-settings.handler';

@Injectable()
export class BookingAutocompleteCron {
  private readonly logger = new Logger(BookingAutocompleteCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  /**
   * Auto-complete bookings per tenant using each tenant's autoCompleteAfterHours setting.
   */
  async execute(): Promise<void> {
    const tenantIds = await this.prisma.booking
      .findMany({
        where: { status: BookingStatus.CONFIRMED },
        select: { tenantId: true },
        distinct: ['tenantId'],
      })
      .then((rows) => rows.map((r) => r.tenantId));

    let totalCompleted = 0;

    for (const tenantId of tenantIds) {
      // Use tenant-global settings for cron jobs — branch-level overrides apply to user-facing flows only.
      const settings = await this.settingsHandler.execute({ tenantId, branchId: null });
      const cutoff = new Date(Date.now() - settings.autoCompleteAfterHours * 3_600_000);

      const result = await this.prisma.booking.updateMany({
        where: {
          tenantId,
          status: BookingStatus.CONFIRMED,
          endsAt: { lte: cutoff },
        },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      totalCompleted += result.count;
    }

    if (totalCompleted > 0) {
      this.logger.log(`completed ${totalCompleted} bookings`);
    }
  }
}
