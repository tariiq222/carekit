import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { RescheduleBookingDto } from './reschedule-booking.dto';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';

export type RescheduleBookingCommand = Omit<RescheduleBookingDto, 'newScheduledAt'> & {
  tenantId: string;
  bookingId: string;
  newScheduledAt: Date;
  changedBy: string;
};

@Injectable()
export class RescheduleBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  async execute(cmd: RescheduleBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, cmd.tenantId, [BookingStatus.PENDING, BookingStatus.CONFIRMED], 'rescheduled');

    const newScheduledAt = new Date(cmd.newScheduledAt);
    if (newScheduledAt <= new Date()) {
      throw new BadRequestException('New scheduled time must be in the future');
    }

    const settings = await this.settingsHandler.execute({
      tenantId: cmd.tenantId,
      branchId: booking.branchId,
    });

    const rescheduleCount = await this.prisma.bookingStatusLog.count({
      where: { bookingId: cmd.bookingId, reason: 'rescheduled' },
    });
    if (rescheduleCount >= settings.maxReschedulesPerBooking) {
      throw new BadRequestException(
        `Maximum reschedules (${settings.maxReschedulesPerBooking}) reached for this booking`,
      );
    }

    const durationMins = cmd.newDurationMins ?? booking.durationMins;
    const newEndsAt = new Date(newScheduledAt.getTime() + durationMins * 60_000);

    // Serialize conflict check + update + status log inside one transaction so
    // two concurrent reschedules to the same slot cannot both pass the check.
    // Postgres Serializable isolation detects write-skew and rolls one back.
    const [updated] = await this.prisma.$transaction(
      async (tx) => {
        const conflict = await tx.booking.findFirst({
          where: {
            tenantId: cmd.tenantId,
            employeeId: booking.employeeId,
            id: { not: cmd.bookingId },
            status: { in: ['PENDING', 'CONFIRMED'] },
            scheduledAt: { lt: newEndsAt },
            endsAt: { gt: newScheduledAt },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ConflictException('Employee already has a booking in the new time slot');
        }

        return Promise.all([
          tx.booking.update({
            where: { id: cmd.bookingId },
            data: { scheduledAt: newScheduledAt, endsAt: newEndsAt, durationMins },
          }),
          tx.bookingStatusLog.create({
            data: {
              tenantId: cmd.tenantId,
              bookingId: cmd.bookingId,
              fromStatus: booking.status,
              toStatus: booking.status,
              changedBy: cmd.changedBy,
              reason: 'rescheduled',
            },
          }),
        ]);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return updated;
  }
}
