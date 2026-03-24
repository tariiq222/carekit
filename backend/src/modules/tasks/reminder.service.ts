import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Run every hour at minute 0 — check for bookings 24h away
  @Cron('0 0 * * * *')
  async sendDayBeforeReminders() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const windowStart = new Date(tomorrow.getTime() - 30 * 60 * 1000); // 23.5h
    const windowEnd = new Date(tomorrow.getTime() + 30 * 60 * 1000);   // 24.5h

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'confirmed',
        deletedAt: null,
        date: { gte: windowStart, lte: windowEnd },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        patientId: true,
        practitionerId: true,
        practitioner: {
          select: { userId: true },
        },
      },
    });

    for (const booking of bookings) {
      const dateStr = booking.date.toISOString().split('T')[0];

      // Notify patient
      await this.notificationsService.createNotification({
        userId: booking.patientId,
        titleAr: 'تذكير بموعدك غداً',
        titleEn: 'Appointment Reminder — Tomorrow',
        bodyAr: `لديك موعد غداً ${dateStr} الساعة ${booking.startTime}`,
        bodyEn: `You have an appointment tomorrow ${dateStr} at ${booking.startTime}`,
        type: 'booking_reminder',
        data: { bookingId: booking.id },
      });

      // Notify practitioner
      if (booking.practitioner?.userId) {
        await this.notificationsService.createNotification({
          userId: booking.practitioner.userId,
          titleAr: 'تذكير بموعد غداً',
          titleEn: 'Appointment Reminder — Tomorrow',
          bodyAr: `لديك موعد غداً ${dateStr} الساعة ${booking.startTime}`,
          bodyEn: `You have an appointment tomorrow ${dateStr} at ${booking.startTime}`,
          type: 'booking_reminder',
          data: { bookingId: booking.id },
        });
      }
    }

    if (bookings.length > 0) {
      this.logger.log(`Sent ${bookings.length} day-before reminders`);
    }
  }

  // Run every 15 minutes — check for bookings 1h away
  @Cron('0 */15 * * * *')
  async sendHourBeforeReminders() {
    const now = new Date();
    const oneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const windowStart = new Date(oneHour.getTime() - 8 * 60 * 1000);  // 52min
    const windowEnd = new Date(oneHour.getTime() + 8 * 60 * 1000);    // 68min

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'confirmed',
        deletedAt: null,
        date: { gte: windowStart, lte: windowEnd },
      },
      select: {
        id: true,
        startTime: true,
        patientId: true,
      },
    });

    for (const booking of bookings) {
      await this.notificationsService.createNotification({
        userId: booking.patientId,
        titleAr: 'موعدك بعد ساعة',
        titleEn: 'Appointment in 1 Hour',
        bodyAr: `تذكير: موعدك بعد ساعة الساعة ${booking.startTime}`,
        bodyEn: `Reminder: Your appointment is in 1 hour at ${booking.startTime}`,
        type: 'booking_reminder',
        data: { bookingId: booking.id },
      });
    }

    if (bookings.length > 0) {
      this.logger.log(`Sent ${bookings.length} hour-before reminders`);
    }
  }
}
