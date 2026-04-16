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
   * Mark CONFIRMED bookings as NO_SHOW using the global autoNoShowAfterMinutes setting.
   */
  async execute(): Promise<void> {
    const settings = await this.settingsHandler.execute({ branchId: null });
    const cutoff = new Date(Date.now() - settings.autoNoShowAfterMinutes * 60_000);

    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.CONFIRMED,
        scheduledAt: { lte: cutoff },
        checkedInAt: null,
      },
      data: {
        status: BookingStatus.NO_SHOW,
        noShowAt: new Date(),
      },
    });

    if (result.count > 0) {
      this.logger.log(`marked ${result.count} as NO_SHOW`);
    }
  }
}
