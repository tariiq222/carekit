import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, RefundType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelledEvent } from '../events/booking-cancelled.event';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { CancelBookingDto } from './cancel-booking.dto';
import { ZoomMeetingService } from '../zoom-meeting.service';

export type CancelBookingCommand = CancelBookingDto & {
  bookingId: string;
  changedBy: string;
};

const CANCELLABLE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  'CANCEL_REQUESTED' as BookingStatus,
];

@Injectable()
export class CancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly eventBus: EventBusService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly zoomMeetingService: ZoomMeetingService,
  ) {}

  async execute(cmd: CancelBookingCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(`Booking cannot be cancelled (status: ${booking.status})`);
    }

    const settings = await this.settingsHandler.execute({
      branchId: booking.branchId,
    });

    if (cmd.source === 'client') {
      const requireApproval = 'requireCancelApproval' in settings
        ? (settings as Record<string, unknown>).requireCancelApproval
        : false;
      if (requireApproval) {
        throw new BadRequestException(
          'Cancel approval is required. Use request-cancel-booking instead.',
        );
      }
    }

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
          zoomMeetingStatus: booking.zoomMeetingId ? 'CANCELLED' : undefined,
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          organizationId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.CANCELLED,
          changedBy: cmd.changedBy,
          reason: cmd.reason,
        },
      }),
    ]);

    const event = new BookingCancelledEvent({
      bookingId: booking.id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      reason: cmd.reason,
      cancelNotes: cmd.cancelNotes,
      zoomMeetingId: (booking as Record<string, unknown>).zoomMeetingId as string | null ?? null,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    if (booking.zoomMeetingId) {
      // Best effort deletion
      this.zoomMeetingService.deleteMeeting(organizationId, booking.zoomMeetingId).catch(() => {});
    }

    return { ...updated, refundType };
  }
}
