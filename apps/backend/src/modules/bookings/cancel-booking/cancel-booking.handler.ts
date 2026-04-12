import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, CancellationReason, RefundType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelledEvent } from '../events/booking-cancelled.event';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';

export interface CancelBookingCommand {
  tenantId: string;
  bookingId: string;
  reason: CancellationReason;
  cancelNotes?: string;
  changedBy: string;
}

const CANCELLABLE_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

@Injectable()
export class CancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  async execute(cmd: CancelBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(`Booking cannot be cancelled (status: ${booking.status})`);
    }

    const settings = await this.settingsHandler.execute({
      tenantId: cmd.tenantId,
      branchId: booking.branchId,
    });

    const hoursUntilBooking = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;
    const refundType = hoursUntilBooking >= settings.freeCancelBeforeHours
      ? settings.freeCancelRefundType
      : RefundType.NONE;

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelReason: cmd.reason,
          cancelNotes: cmd.cancelNotes,
          cancelledAt: new Date(),
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.CANCELLED,
          changedBy: cmd.changedBy,
          reason: cmd.reason,
        },
      }),
    ]);

    const event = new BookingCancelledEvent(cmd.tenantId, {
      bookingId: booking.id,
      tenantId: booking.tenantId,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      reason: cmd.reason,
      cancelNotes: cmd.cancelNotes,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return { ...updated, refundType };
  }
}
