import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service.js';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly clinicSettingsService: ClinicSettingsService,
  ) {}

  /** Check for bookings ~24h away and notify both patient and practitioner */
  async sendDayBeforeReminders() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const windowStart = new Date(tomorrow.getTime() - 30 * 60 * 1000); // 23.5h
    const windowEnd = new Date(tomorrow.getTime() + 30 * 60 * 1000); // 24.5h

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

    await Promise.all(
      bookings.flatMap((booking) => {
        const dateStr = booking.date.toISOString().split('T')[0];
        const timePromise = this.formatTimeForNotification(booking.startTime);
        const notifications: Promise<unknown>[] = [];

        if (booking.patientId) {
          notifications.push(
            timePromise.then((timeStr) =>
              this.notificationsService.createNotification({
                userId: booking.patientId!,
                titleAr: 'تذكير بموعدك غداً',
                titleEn: 'Appointment Reminder — Tomorrow',
                bodyAr: `لديك موعد غداً ${dateStr} الساعة ${timeStr}`,
                bodyEn: `You have an appointment tomorrow ${dateStr} at ${timeStr}`,
                type: 'booking_reminder',
                data: { bookingId: booking.id },
              }),
            ),
          );
        }

        if (booking.practitioner?.userId) {
          notifications.push(
            timePromise.then((timeStr) =>
              this.notificationsService.createNotification({
                userId: booking.practitioner.userId,
                titleAr: 'تذكير بموعد غداً',
                titleEn: 'Appointment Reminder — Tomorrow',
                bodyAr: `لديك موعد غداً ${dateStr} الساعة ${timeStr}`,
                bodyEn: `You have an appointment tomorrow ${dateStr} at ${timeStr}`,
                type: 'booking_reminder',
                data: { bookingId: booking.id },
              }),
            ),
          );
        }

        return notifications;
      }),
    );

    if (bookings.length > 0) {
      this.logger.log(`Sent ${bookings.length} day-before reminders`);
    }
  }

  /** Check for bookings ~1h away and notify the patient */
  async sendHourBeforeReminders() {
    const now = new Date();
    const oneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const windowStart = new Date(oneHour.getTime() - 8 * 60 * 1000); // 52min
    const windowEnd = new Date(oneHour.getTime() + 8 * 60 * 1000); // 68min

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

    await Promise.all(
      bookings
        .filter((booking) => booking.patientId)
        .map(async (booking) => {
          const timeStr = await this.formatTimeForNotification(
            booking.startTime,
          );
          return this.notificationsService.createNotification({
            userId: booking.patientId!,
            titleAr: 'موعدك بعد ساعة',
            titleEn: 'Appointment in 1 Hour',
            bodyAr: `تذكير: موعدك بعد ساعة الساعة ${timeStr}`,
            bodyEn: `Reminder: Your appointment is in 1 hour at ${timeStr}`,
            type: 'booking_reminder',
            data: { bookingId: booking.id },
          });
        }),
    );

    if (bookings.length > 0) {
      this.logger.log(`Sent ${bookings.length} hour-before reminders`);
    }
  }

  /** Check for bookings ~2h away and notify both patient and practitioner */
  async sendTwoHourReminders() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'confirmed',
        date: today,
        deletedAt: null,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        patientId: true,
        practitioner: {
          select: { userId: true },
        },
      },
    });

    const matched = bookings.filter((booking) => {
      const bookingDt = this.combineDateAndTime(
        booking.date,
        booking.startTime,
      );
      const diffMin = (bookingDt.getTime() - now.getTime()) / 60_000;
      return diffMin >= 90 && diffMin <= 150; // 1.5h–2.5h window
    });

    await Promise.all(
      matched.flatMap((booking) => {
        const timePromise = this.formatTimeForNotification(booking.startTime);
        const notifications: Promise<unknown>[] = [];

        if (booking.patientId) {
          notifications.push(
            timePromise.then((timeStr) =>
              this.notificationsService.createNotification({
                userId: booking.patientId!,
                titleAr: 'موعدك بعد ساعتين',
                titleEn: 'Appointment in 2 Hours',
                bodyAr: `تذكير: موعدك بعد ساعتين الساعة ${timeStr}`,
                bodyEn: `Reminder: Your appointment is in 2 hours at ${timeStr}`,
                type: 'booking_reminder',
                data: { bookingId: booking.id },
              }),
            ),
          );
        }

        if (booking.practitioner?.userId) {
          notifications.push(
            timePromise.then((timeStr) =>
              this.notificationsService.createNotification({
                userId: booking.practitioner.userId,
                titleAr: 'موعدك بعد ساعتين',
                titleEn: 'Appointment in 2 Hours',
                bodyAr: `تذكير: لديك موعد بعد ساعتين الساعة ${timeStr}`,
                bodyEn: `Reminder: You have an appointment in 2 hours at ${timeStr}`,
                type: 'booking_reminder',
                data: { bookingId: booking.id },
              }),
            ),
          );
        }

        return notifications;
      }),
    );

    if (matched.length > 0) {
      this.logger.log(`Sent ${matched.length} two-hour reminders`);
    }
  }

  /** Check for bookings ~15min away and notify the patient only */
  async sendUrgentReminders() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'confirmed',
        date: today,
        deletedAt: null,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        patientId: true,
        practitioner: {
          select: { userId: true },
        },
      },
    });

    const matched = bookings.filter((booking) => {
      const bookingDt = this.combineDateAndTime(
        booking.date,
        booking.startTime,
      );
      const diffMin = (bookingDt.getTime() - now.getTime()) / 60_000;
      return diffMin >= 10 && diffMin <= 20; // 10–20min window
    });

    await Promise.all(
      matched
        .filter((booking) => booking.patientId)
        .map(async (booking) => {
          const timeStr = await this.formatTimeForNotification(
            booking.startTime,
          );
          return this.notificationsService.createNotification({
            userId: booking.patientId!,
            titleAr: 'موعدك بعد 15 دقيقة!',
            titleEn: 'Appointment in 15 Minutes!',
            bodyAr: `تذكير عاجل: موعدك بعد 15 دقيقة الساعة ${timeStr}`,
            bodyEn: `Urgent: Your appointment is in 15 minutes at ${timeStr}`,
            type: 'booking_reminder_urgent',
            data: { bookingId: booking.id },
          });
        }),
    );

    if (matched.length > 0) {
      this.logger.log(`Sent ${matched.length} urgent (15-min) reminders`);
    }
  }

  /** Format a time string according to clinic's time_format config */
  private async formatTimeForNotification(time: string): Promise<string> {
    const format = await this.clinicSettingsService.getTimeFormat();
    if (format === '12h') {
      const [hourStr, minuteStr] = time.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = minuteStr?.padStart(2, '0') ?? '00';
      if (isNaN(hour)) return time;
      const period = hour >= 12 ? 'م' : 'ص';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minute} ${period}`;
    }
    return time; // 24h — return as-is
  }

  /** Combine a date-only Date with an HH:mm startTime string */
  private combineDateAndTime(date: Date, startTime: string): Date {
    const [hours, minutes] = startTime.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  }
}
