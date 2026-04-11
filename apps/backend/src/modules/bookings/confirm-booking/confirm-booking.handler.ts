import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingConfirmedEvent } from '../events/booking-confirmed.event';

export interface ConfirmBookingCommand {
  tenantId: string;
  bookingId: string;
}

@Injectable()
export class ConfirmBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: ConfirmBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(`Only PENDING bookings can be confirmed (status: ${booking.status})`);
    }

    const updated = await this.prisma.booking.update({
      where: { id: cmd.bookingId },
      data: { status: BookingStatus.CONFIRMED, confirmedAt: new Date() },
    });

    const event = new BookingConfirmedEvent(cmd.tenantId, {
      bookingId: booking.id,
      tenantId: booking.tenantId,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      branchId: booking.branchId,
      serviceId: booking.serviceId,
      scheduledAt: booking.scheduledAt,
      price: Number(booking.price),
      currency: booking.currency,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return updated;
  }
}
