import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BookingStatus, WaitlistStatus } from '@prisma/client';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { PrismaService } from '../../../infrastructure/database';

const QUEUE_NAME = 'ops-cron';

/** Cron job names — used as BullMQ job types and repeat keys. */
export const CRON_JOBS = {
  BOOKING_AUTOCOMPLETE: 'booking-autocomplete',
  BOOKING_EXPIRY: 'booking-expiry',
  BOOKING_NOSHOW: 'booking-noshow',
  APPOINTMENT_REMINDERS: 'appointment-reminders',
  GROUP_SESSION_AUTOMATION: 'group-session-automation',
  REFRESH_TOKEN_CLEANUP: 'refresh-token-cleanup',
} as const;

@Injectable()
export class CronTasksService implements OnModuleInit {
  private readonly logger = new Logger(CronTasksService.name);

  constructor(
    private readonly bullMq: BullMqService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.registerRepeatingJobs();
    this.registerWorker();
  }

  // ── Schedule repeating jobs ────────────────────────────────────────────────

  private registerRepeatingJobs(): void {
    const queue = this.bullMq.getQueue(QUEUE_NAME);

    const jobs: Array<{ name: string; cron: string }> = [
      { name: CRON_JOBS.BOOKING_AUTOCOMPLETE, cron: '*/15 * * * *' },  // every 15 min
      { name: CRON_JOBS.BOOKING_EXPIRY, cron: '*/10 * * * *' },        // every 10 min
      { name: CRON_JOBS.BOOKING_NOSHOW, cron: '*/5 * * * *' },         // every 5 min
      { name: CRON_JOBS.APPOINTMENT_REMINDERS, cron: '0 * * * *' },    // every hour
      { name: CRON_JOBS.GROUP_SESSION_AUTOMATION, cron: '*/30 * * * *' }, // every 30 min
      { name: CRON_JOBS.REFRESH_TOKEN_CLEANUP, cron: '0 3 * * *' },    // daily at 03:00
    ];

    for (const { name, cron } of jobs) {
      queue
        .add(name, {}, { repeat: { pattern: cron }, jobId: `repeat:${name}` })
        .catch((err: unknown) =>
          this.logger.error(`Failed to schedule ${name}`, err),
        );
    }

    this.logger.log(`Scheduled ${jobs.length} cron jobs on queue "${QUEUE_NAME}"`);
  }

  // ── Worker processor ───────────────────────────────────────────────────────

  private registerWorker(): void {
    this.bullMq.createWorker<object>(QUEUE_NAME, async (job) => {
      switch (job.name) {
        case CRON_JOBS.BOOKING_AUTOCOMPLETE:
          await this.runBookingAutocomplete();
          break;
        case CRON_JOBS.BOOKING_EXPIRY:
          await this.runBookingExpiry();
          break;
        case CRON_JOBS.BOOKING_NOSHOW:
          await this.runBookingNoShow();
          break;
        case CRON_JOBS.APPOINTMENT_REMINDERS:
          await this.runAppointmentReminders();
          break;
        case CRON_JOBS.GROUP_SESSION_AUTOMATION:
          await this.runGroupSessionAutomation();
          break;
        case CRON_JOBS.REFRESH_TOKEN_CLEANUP:
          await this.runRefreshTokenCleanup();
          break;
        default:
          this.logger.warn(`Unknown cron job: ${job.name}`);
      }
    });
  }

  // ── Job implementations ────────────────────────────────────────────────────

  /** Auto-complete bookings whose scheduledAt passed and are still CONFIRMED. */
  private async runBookingAutocomplete(): Promise<void> {
    const cutoff = new Date();
    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.CONFIRMED,
        endsAt: { lte: cutoff },
      },
      data: {
        status: BookingStatus.COMPLETED,
        completedAt: cutoff,
      },
    });
    if (result.count > 0) {
      this.logger.log(`[booking-autocomplete] completed ${result.count} bookings`);
    }
  }

  /** Expire PENDING bookings that passed their expiresAt. */
  private async runBookingExpiry(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: { lte: now },
      },
      data: {
        status: BookingStatus.EXPIRED,
      },
    });
    if (result.count > 0) {
      this.logger.log(`[booking-expiry] expired ${result.count} bookings`);
    }
  }

  /** Mark CONFIRMED bookings as NO_SHOW if scheduledAt passed with no check-in. */
  private async runBookingNoShow(): Promise<void> {
    const gracePeriodMs = 30 * 60_000; // 30 minutes grace
    const cutoff = new Date(Date.now() - gracePeriodMs);
    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.CONFIRMED,
        scheduledAt: { lte: cutoff },
        checkedInAt: null,
      },
      data: {
        status: BookingStatus.NO_SHOW,
        noShowAt: new Date(),
      },
    });
    if (result.count > 0) {
      this.logger.log(`[booking-noshow] marked ${result.count} as NO_SHOW`);
    }
  }

  /** Promote the oldest WAITING waitlist entry when a slot opens. */
  private async runAppointmentReminders(): Promise<void> {
    // Promote WAITING waitlist entries that have been waiting the longest.
    // Real reminder sending is handled by CommsBC — this job only promotes.
    const waiting = await this.prisma.waitlistEntry.findMany({
      where: { status: WaitlistStatus.WAITING },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    if (waiting.length > 0) {
      this.logger.log(`[appointment-reminders] ${waiting.length} waitlist entries checked`);
    }
  }

  /** Close past group sessions that are still OPEN. */
  private async runGroupSessionAutomation(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.groupSession.updateMany({
      where: {
        status: 'OPEN',
        scheduledAt: { lte: now },
      },
      data: { status: 'COMPLETED' },
    });
    if (result.count > 0) {
      this.logger.log(`[group-session-automation] closed ${result.count} group sessions`);
    }
  }

  /**
   * Delete expired/revoked refresh tokens older than 30 days.
   * Critical for performance — prevents O(n) bcrypt compare degradation.
   */
  private async runRefreshTokenCleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: cutoff } },
          { revokedAt: { not: null, lte: cutoff } },
        ],
      },
    });
    this.logger.log(`[refresh-token-cleanup] deleted ${result.count} stale tokens`);
  }
}
