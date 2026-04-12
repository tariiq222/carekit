import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { BookingCancelApprovedEvent } from '../events/booking-cancel-approved.event';

export interface ApproveCancelBookingCommand {
  tenantId: string;
  bookingId: string;
  approvedBy: string;
  approverNotes?: string;
}

@Injectable()
export class ApproveCancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  async execute(cmd: ApproveCancelBookingCommand) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: cmd.bookingId },
    });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== ('CANCEL_REQUESTED' as BookingStatus)) {
      throw new BadRequestException(
        `Only CANCEL_REQUESTED bookings can be approved (status: ${booking.status})`,
      );
    }

    const settings = await this.settingsHandler.execute({
      tenantId: cmd.tenantId,
      branchId: booking.branchId,
    });

    const autoRefund =
      'autoRefundOnCancel' in settings
        ? (settings as Record<string, unknown>).autoRefundOnCancel === true
        : true;

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: 'CANCEL_REQUESTED' as BookingStatus,
          toStatus: BookingStatus.CANCELLED,
          changedBy: cmd.approvedBy,
          reason: cmd.approverNotes ?? 'Cancel request approved',
        },
      }),
    ]);

    const event = new BookingCancelApprovedEvent(cmd.tenantId, {
      bookingId: booking.id,
      tenantId: booking.tenantId,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      autoRefund,
      approverNotes: cmd.approverNotes,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return { ...updated, autoRefund };
  }
}
