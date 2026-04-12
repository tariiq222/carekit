import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { RescheduleBookingDto } from './reschedule-booking.dto';

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
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Booking cannot be rescheduled (status: ${booking.status})`);
    }

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

    const conflict = await this.prisma.booking.findFirst({
      where: {
        tenantId: cmd.tenantId,
        employeeId: booking.employeeId,
        id: { not: cmd.bookingId },
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { lt: newEndsAt },
        endsAt: { gt: newScheduledAt },
      },
    });
    if (conflict) throw new ConflictException('Employee already has a booking in the new time slot');

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: { scheduledAt: newScheduledAt, endsAt: newEndsAt, durationMins },
      }),
      this.prisma.bookingStatusLog.create({
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

    return updated;
  }
}
