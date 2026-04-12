import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelRequestedEvent } from '../events/booking-cancel-requested.event';

export interface RequestCancelBookingCommand {
  tenantId: string;
  bookingId: string;
  reason: CancellationReason;
  cancelNotes?: string;
  requestedBy: string;
}

@Injectable()
export class RequestCancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: RequestCancelBookingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId, tenantId: cmd.tenantId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }

    const cancellable: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
    ];
    if (!cancellable.includes(booking.status)) {
      throw new BadRequestException(
        `Booking cannot be cancelled (status: ${booking.status})`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: 'CANCEL_REQUESTED' as BookingStatus,
          cancelReason: cmd.reason,
          cancelNotes: cmd.cancelNotes,
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: 'CANCEL_REQUESTED' as BookingStatus,
          changedBy: cmd.requestedBy,
          reason: cmd.reason,
        },
      }),
    ]);

    const event = new BookingCancelRequestedEvent(cmd.tenantId, {
      bookingId: booking.id,
      tenantId: booking.tenantId,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      reason: cmd.reason,
      cancelNotes: cmd.cancelNotes,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return updated;
  }
}
