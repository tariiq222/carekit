import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../bookings/booking-settings.service.js';
import { BookingStatusLogService } from '../bookings/booking-status-log.service.js';
import { CLINIC_TIMEZONE } from '../../config/constants/index.js';

@Injectable()
export class BookingAutocompleteService {
  private readonly logger = new Logger(BookingAutocompleteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly statusLogService: BookingStatusLogService,
  ) {}

  /** Auto-complete bookings that are past the auto-complete window */
  async autoCompleteBookings(): Promise<void> {
    const settings = await this.bookingSettingsService.get();
    const now = new Date();

    const riyadhTomorrow = new Date(
      new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TIMEZONE }).format(
        now,
      ) + 'T00:00:00+03:00',
    );
    riyadhTomorrow.setDate(riyadhTomorrow.getDate() + 1);

    const candidates = await this.prisma.booking.findMany({
      where: {
        status: { in: ['confirmed', 'in_progress', 'checked_in'] },
        date: { lt: riyadhTomorrow },
        deletedAt: null,
      },
      select: { id: true, patientId: true, date: true, endTime: true, status: true },
    });

    const autoCompleteMs = settings.autoCompleteAfterHours * 60 * 60 * 1000;
    const bookings = candidates.filter((b) => {
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: CLINIC_TIMEZONE,
      }).format(b.date);
      const bookingEnd = new Date(`${dateStr}T${b.endTime}:00+03:00`);
      return now.getTime() > bookingEnd.getTime() + autoCompleteMs;
    });

    for (const booking of bookings) {
      try {
        const fromStatus = booking.status;
        const transitioned = await this.prisma.$transaction(async (tx) => {
          // Re-check status inside transaction to prevent race with manual complete
          const current = await tx.booking.findFirst({
            where: {
              id: booking.id,
              status: { in: ['confirmed', 'in_progress', 'checked_in'] },
              deletedAt: null,
            },
            select: { id: true },
          });
          if (!current) return false; // Already completed or cancelled

          await tx.booking.update({
            where: { id: booking.id },
            data: { status: 'completed', completedAt: new Date() },
          });
          return true;
        }, { isolationLevel: 'Serializable', timeout: 10000 });

        if (!transitioned) continue;

        this.statusLogService.log({
          bookingId: booking.id,
          fromStatus,
          toStatus: 'completed',
          changedBy: 'system',
          reason: `Auto-completed after ${settings.autoCompleteAfterHours}h post-end-time`,
        }).catch(() => {});

        if (booking.patientId) {
          await this.notificationsService.createNotification({
            userId: booking.patientId,
            titleAr: 'كيف كانت تجربتك؟',
            titleEn: 'How was your experience?',
            bodyAr: 'يسعدنا معرفة رأيك في الموعد. قيّم تجربتك الآن.',
            bodyEn: 'We would love your feedback. Please rate your appointment.',
            type: 'booking_completed',
            data: { bookingId: booking.id },
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to auto-complete booking ${booking.id}: ${(err as Error).message}`);
      }
    }

    if (bookings.length > 0) {
      this.logger.log(`Auto-completed ${bookings.length} bookings`);
      this.activityLogService
        .log({
          action: 'booking_auto_completed',
          module: 'bookings',
          description: `Auto-completed ${bookings.length} bookings`,
        })
        .catch(() => {});
    }
  }
}
