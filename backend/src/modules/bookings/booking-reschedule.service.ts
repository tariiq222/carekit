import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ZoomService } from '../integrations/zoom/zoom.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingQueryService } from './booking-query.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto.js';
import { validateAvailability, checkDoubleBooking } from './booking-validation.helper.js';
import { calculateEndTime } from '../../common/helpers/booking-time.helper.js';
import { bookingInclude } from './booking.constants.js';
import { NOTIF } from '../../common/constants/notification-messages.js';

@Injectable()
export class BookingRescheduleService {
  private readonly logger = new Logger(BookingRescheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomService: ZoomService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly queryService: BookingQueryService,
    private readonly settingsService: BookingSettingsService,
  ) {}

  async reschedule(id: string, dto: RescheduleBookingDto, adminUserId?: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, deletedAt: null } });
    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }

    const newStartTime = dto.startTime ?? booking.startTime;
    const newDate = dto.date ? new Date(dto.date) : booking.date;
    const [ps, svc, settings] = await Promise.all([
      this.prisma.practitionerService.findUnique({ where: { id: booking.practitionerServiceId } }),
      this.prisma.service.findFirst({ where: { id: booking.serviceId } }),
      this.settingsService.getForBranch(booking.branchId ?? undefined),
    ]);
    const duration = booking.bookedDuration ?? ps?.customDuration ?? svc?.duration ?? 30;
    const newEndTime = calculateEndTime(newStartTime, duration);

    let zoomData: { zoomMeetingId?: string; zoomJoinUrl?: string; zoomHostUrl?: string } = {};
    if (booking.type === 'online') {
      const isoStart = `${newDate.toISOString().split('T')[0]}T${newStartTime}:00`;
      const mtg = await this.zoomService.createMeeting('CareKit Video Consultation', isoStart, duration);
      zoomData = { zoomMeetingId: mtg.meetingId, zoomJoinUrl: mtg.joinUrl, zoomHostUrl: mtg.hostUrl };
    }
    const oldZoomId = booking.zoomMeetingId;
    const skipAvailability = adminUserId && settings.adminCanBookOutsideHours;
    const bufferMinutes = ps?.bufferMinutes ?? svc?.bufferMinutes ?? settings.bufferMinutes;

    // Enforce minimum lead time (skip for admins with override permission)
    if (!skipAvailability && settings.minBookingLeadMinutes > 0) {
      const bookingDateTime = new Date(newDate);
      const [leadH, leadM] = newStartTime.split(':').map(Number);
      bookingDateTime.setHours(leadH, leadM, 0, 0);
      const minutesUntil = (bookingDateTime.getTime() - Date.now()) / (1000 * 60);
      if (minutesUntil < settings.minBookingLeadMinutes) {
        throw new BadRequestException({
          statusCode: 400,
          message: `Booking must be made at least ${settings.minBookingLeadMinutes} minutes in advance`,
          error: 'BOOKING_LEAD_TIME_VIOLATION',
        });
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (!skipAvailability) {
        await validateAvailability(tx, booking.practitionerId, newDate, newStartTime, newEndTime, booking.branchId ?? undefined);
      }
      await checkDoubleBooking(tx, booking.practitionerId, newDate, newStartTime, newEndTime, id, bufferMinutes);
      const nb = await tx.booking.create({
        data: {
          patientId: booking.patientId, branchId: booking.branchId, practitionerId: booking.practitionerId,
          serviceId: booking.serviceId, practitionerServiceId: booking.practitionerServiceId,
          type: booking.type, date: newDate, startTime: newStartTime, endTime: newEndTime,
          status: booking.status, notes: booking.notes, ...zoomData,
          confirmedAt: booking.confirmedAt, rescheduledFromId: id,
          bookedPrice: booking.bookedPrice, bookedDuration: booking.bookedDuration,
          durationOptionId: booking.durationOptionId,
        },
        include: bookingInclude,
      });
      await tx.booking.update({ where: { id }, data: { status: 'cancelled', cancelledAt: new Date(), adminNotes: `Rescheduled to booking ${nb.id}` } });
      await tx.payment.updateMany({ where: { bookingId: id }, data: { bookingId: nb.id } });
      return nb;
    }, { isolationLevel: 'Serializable', timeout: 10000 });

    if (booking.type === 'online' && oldZoomId) {
      this.zoomService.deleteMeeting(oldZoomId).catch((e) => this.logger.warn(`Failed to delete old Zoom meeting: ${e.message}`));
    }
    await this.notifyReschedule(booking, result, newDate, newStartTime);
    this.activityLogService.log({
      action: 'booking_rescheduled', module: 'bookings', resourceId: result.id, userId: adminUserId,
      description: `Booking rescheduled to ${newDate.toISOString().split('T')[0]} at ${newStartTime}`,
    }).catch((err) => this.logger.warn('Activity log failed', { error: err?.message }));
    return result;
  }

  private async notifyReschedule(
    old: { patientId: string | null; practitionerId: string; date: Date; startTime: string },
    newB: { id: string }, newDate: Date, newStart: string,
  ): Promise<void> {
    const [oldD, newD] = [old.date.toISOString().split('T')[0], newDate.toISOString().split('T')[0]];
    if (old.patientId) {
      await this.notificationsService.createNotification({
        userId: old.patientId, type: 'booking_rescheduled',
        ...NOTIF.BOOKING_RESCHEDULED,
        bodyAr: `تم إعادة جدولة موعدك من ${oldD} ${old.startTime} إلى ${newD} ${newStart}`,
        bodyEn: `Your booking rescheduled from ${oldD} ${old.startTime} to ${newD} ${newStart}`,
        data: { bookingId: newB.id },
      });
    }
    const pract = await this.prisma.practitioner.findUnique({ where: { id: old.practitionerId } });
    if (pract?.userId) {
      await this.notificationsService.createNotification({
        userId: pract.userId, type: 'booking_rescheduled',
        ...NOTIF.BOOKING_RESCHEDULED_PRACTITIONER,
        data: { bookingId: newB.id },
      });
    }
  }
}
