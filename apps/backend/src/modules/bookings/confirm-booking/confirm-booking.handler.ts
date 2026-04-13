import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingConfirmedEvent } from '../events/booking-confirmed.event';
import { CreateZoomMeetingHandler } from '../create-zoom-meeting/create-zoom-meeting.handler';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';

export interface ConfirmBookingCommand {
  tenantId: string;
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class ConfirmBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly createZoomMeeting: CreateZoomMeetingHandler,
  ) {}

  async execute(cmd: ConfirmBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, cmd.tenantId, [BookingStatus.PENDING], 'confirmed');

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: { status: BookingStatus.CONFIRMED, confirmedAt: new Date() },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.CONFIRMED,
          changedBy: cmd.changedBy,
        },
      }),
    ]);

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
      couponCode: (booking as any).couponCode ?? null,
      discountedPrice: (booking as any).discountedPrice ? Number((booking as any).discountedPrice) : null,
      bookingType: booking.bookingType,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    if ((booking.bookingType as string) === 'ONLINE') {
      await this.createZoomMeeting.execute({
        tenantId: cmd.tenantId,
        bookingId: cmd.bookingId,
      });
    }

    return updated;
  }
}
