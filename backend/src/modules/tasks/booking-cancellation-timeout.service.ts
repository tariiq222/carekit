import { Injectable, Logger } from '@nestjs/common';
import { CancelledBy } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../bookings/booking-settings.service.js';
import { WaitlistService } from '../bookings/waitlist.service.js';

@Injectable()
export class BookingCancellationTimeoutService {
  private readonly logger = new Logger(BookingCancellationTimeoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly waitlistService: WaitlistService,
  ) {}

  /** Auto-approve stale pending_cancellation requests after timeout */
  async autoExpirePendingCancellations(): Promise<void> {
    const settings = await this.bookingSettingsService.get();
    const cutoff = new Date(
      Date.now() -
        settings.cancellationReviewTimeoutHours * 60 * 60 * 1000,
    );

    const staleBookings = await this.prisma.booking.findMany({
      where: {
        status: 'pending_cancellation',
        updatedAt: { lt: cutoff },
        deletedAt: null,
      },
      select: { id: true, patientId: true, practitionerId: true, date: true },
    });

    for (const booking of staleBookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'cancelled',
          cancelledBy: CancelledBy.system,
          cancelledAt: new Date(),
          adminNotes: `Auto-approved after ${settings.cancellationReviewTimeoutHours}h timeout`,
        },
      });

      // Full refund — clinic failed to respond in time
      const payment = await this.prisma.payment.findUnique({
        where: { bookingId: booking.id },
      });
      if (payment && payment.status === 'paid') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'refunded', refundAmount: payment.totalAmount },
        });
      }

      if (booking.patientId) {
        await this.notificationsService.createNotification({
          userId: booking.patientId,
          titleAr: 'تمت الموافقة على إلغاء موعدك',
          titleEn: 'Cancellation Auto-Approved',
          bodyAr: 'تمت الموافقة تلقائياً على طلب إلغاء موعدك مع استرداد كامل',
          bodyEn: 'Your cancellation request was auto-approved with a full refund',
          type: 'booking_cancelled',
          data: { bookingId: booking.id },
        });
      }

      await this.waitlistService
        .checkAndNotify(booking.practitionerId, booking.date)
        .catch(() => {});
    }

    if (staleBookings.length > 0) {
      this.logger.log(
        `Auto-approved ${staleBookings.length} stale cancellation requests`,
      );
      this.activityLogService
        .log({
          action: 'cancellation_auto_approved',
          module: 'bookings',
          description: `Auto-approved ${staleBookings.length} stale pending_cancellation requests`,
        })
        .catch(() => {});
    }
  }
}
