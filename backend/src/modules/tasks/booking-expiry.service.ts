import { Injectable, Logger } from '@nestjs/common';
import { CancelledBy } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../bookings/booking-settings.service.js';
import { BookingStatusLogService } from '../bookings/booking-status-log.service.js';
import { WaitlistService } from '../bookings/waitlist.service.js';

@Injectable()
export class BookingExpiryService {
  private readonly logger = new Logger(BookingExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly statusLogService: BookingStatusLogService,
    private readonly waitlistService: WaitlistService,
  ) {}

  /** Expire pending bookings that exceeded the payment timeout */
  async expirePendingBookings(): Promise<void> {
    const settings = await this.bookingSettingsService.get();
    const cutoff = new Date(
      Date.now() - settings.paymentTimeoutMinutes * 60 * 1000,
    );

    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: 'pending',
        isWalkIn: false,
        createdAt: { lt: cutoff },
        deletedAt: null,
        payment: { is: null },
      },
      select: {
        id: true,
        patientId: true,
        practitionerId: true,
        date: true,
        type: true,
        zoomMeetingId: true,
      },
    });

    const safeToExpire = await this.filterSafeToExpire(expiredBookings);

    for (const booking of safeToExpire) {
      try {
        const transitioned = await this.prisma.$transaction(async (tx) => {
          // Atomic: re-check status inside transaction to prevent race with manual cancel
          const current = await tx.booking.findFirst({
            where: { id: booking.id, status: 'pending', deletedAt: null },
            select: { id: true },
          });
          if (!current) return false; // Already transitioned by another process

          await tx.booking.update({
            where: { id: booking.id },
            data: { status: 'expired', cancelledBy: CancelledBy.system },
          });

          await tx.payment.deleteMany({
            where: { bookingId: booking.id, status: 'awaiting' },
          });
          return true;
        }, { isolationLevel: 'Serializable', timeout: 10000 });

        if (!transitioned) continue;

        this.statusLogService.log({
          bookingId: booking.id,
          fromStatus: 'pending',
          toStatus: 'expired',
          changedBy: 'system',
          reason: 'Auto-expired: payment timeout exceeded',
        }).catch(() => {});

        if (booking.patientId) {
          await this.notificationsService.createNotification({
            userId: booking.patientId,
            titleAr: 'انتهت صلاحية الحجز',
            titleEn: 'Booking Expired',
            bodyAr: 'انتهت صلاحية حجزك بسبب عدم إتمام الدفع',
            bodyEn: 'Your booking has expired due to incomplete payment',
            type: 'booking_expired',
            data: { bookingId: booking.id },
          });
        }

        await this.waitlistService
          .checkAndNotify(booking.practitionerId, booking.date)
          .catch(() => {});
      } catch (err) {
        this.logger.warn(`Failed to expire booking ${booking.id}: ${(err as Error).message}`);
      }
    }

    if (safeToExpire.length > 0) {
      this.logger.log(`Expired ${safeToExpire.length} pending bookings`);
      this.activityLogService
        .log({
          action: 'booking_expired',
          module: 'bookings',
          description: `Auto-expired ${safeToExpire.length} pending bookings`,
        })
        .catch(() => {});
    }
  }

  private async filterSafeToExpire<T extends { id: string }>(
    bookings: T[],
  ): Promise<T[]> {
    const safe: T[] = [];
    for (const booking of bookings) {
      const paidPayment = await this.prisma.payment.findFirst({
        where: { bookingId: booking.id, status: { in: ['paid', 'pending'] } },
        select: { id: true },
      });
      if (!paidPayment) {
        safe.push(booking);
      } else {
        this.logger.warn(
          `Skipping expire for booking ${booking.id} — payment still active`,
        );
      }
    }
    return safe;
  }
}
