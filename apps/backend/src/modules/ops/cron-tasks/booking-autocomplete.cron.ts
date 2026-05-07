import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../common/tenant/tenant.constants';
import { DEFAULT_BOOKING_SETTINGS } from '../../bookings/get-booking-settings/get-booking-settings.handler';

@Injectable()
export class BookingAutocompleteCron {
  private readonly logger = new Logger(BookingAutocompleteCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async execute(): Promise<void> {
    await this.cls.run(async () => {
      this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      const globalRow = await this.prisma.$allTenants.bookingSettings.findFirst({
        where: { branchId: null },
      });
      const hours = globalRow?.autoCompleteAfterHours ?? DEFAULT_BOOKING_SETTINGS.autoCompleteAfterHours;
      const cutoff = new Date(Date.now() - hours * 3_600_000);

      const result = await this.prisma.$allTenants.booking.updateMany({
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
    });
  }
}
