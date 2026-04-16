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
   * Auto-complete confirmed bookings using the global autoCompleteAfterHours setting.
   */
  async execute(): Promise<void> {
    const settings = await this.settingsHandler.execute({ branchId: null });
    const cutoff = new Date(Date.now() - settings.autoCompleteAfterHours * 3_600_000);

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

    if (result.count > 0) {
      this.logger.log(`completed ${result.count} bookings`);
    }
  }
}
