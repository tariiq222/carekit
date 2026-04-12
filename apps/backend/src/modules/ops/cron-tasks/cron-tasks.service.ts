import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BookingStatus, WaitlistStatus } from '@prisma/client';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { PrismaService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../../bookings/get-booking-settings/get-booking-settings.handler';

const QUEUE_NAME = 'ops-cron';

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
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  onModuleInit(): void {
    this.registerRepeatingJobs();
    this.registerWorker();
  }

  private registerRepeatingJobs(): void {
    const queue = this.bullMq.getQueue(QUEUE_NAME);

    const jobs: Array<{ name: string; cron: string }> = [
      { name: CRON_JOBS.BOOKING_AUTOCOMPLETE, cron: '*/15 * * * *' },
      { name: CRON_JOBS.BOOKING_EXPIRY, cron: '*/10 * * * *' },
      { name: CRON_JOBS.BOOKING_NOSHOW, cron: '*/5 * * * *' },
      { name: CRON_JOBS.APPOINTMENT_REMINDERS, cron: '0 * * * *' },
      { name: CRON_JOBS.GROUP_SESSION_AUTOMATION, cron: '*/30 * * * *' },
      { name: CRON_JOBS.REFRESH_TOKEN_CLEANUP, cron: '0 3 * * *' },
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

  /**
   * Auto-complete bookings per tenant using each tenant's autoCompleteAfterHours setting.
   */
  private async runBookingAutocomplete(): Promise<void> {
    const tenantIds = await this.prisma.booking
      .findMany({
        where: { status: BookingStatus.CONFIRMED },
        select: { tenantId: true },
        distinct: ['tenantId'],
      })
      .then((rows) => rows.map((r) => r.tenantId));

    let totalCompleted = 0;

    for (const tenantId of tenantIds) {
      // Use tenant-global settings for cron jobs — branch-level overrides apply to user-facing flows only.
      const settings = await this.settingsHandler.execute({ tenantId, branchId: null });
      const cutoff = new Date(Date.now() - settings.autoCompleteAfterHours * 3_600_000);

      const result = await this.prisma.booking.updateMany({
        where: {
          tenantId,
          status: BookingStatus.CONFIRMED,
          endsAt: { lte: cutoff },
        },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      totalCompleted += result.count;
    }

    if (totalCompleted > 0) {
      this.logger.log(`[booking-autocomplete] completed ${totalCompleted} bookings`);
    }
  }

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

  /**
   * Mark CONFIRMED bookings as NO_SHOW per tenant using each tenant's autoNoShowAfterMinutes setting.
   */
  private async runBookingNoShow(): Promise<void> {
    const tenantIds = await this.prisma.booking
      .findMany({
        where: { status: BookingStatus.CONFIRMED },
        select: { tenantId: true },
        distinct: ['tenantId'],
      })
      .then((rows) => rows.map((r) => r.tenantId));

    let totalNoShow = 0;

    for (const tenantId of tenantIds) {
      // Use tenant-global settings for cron jobs — branch-level overrides apply to user-facing flows only.
      const settings = await this.settingsHandler.execute({ tenantId, branchId: null });
      const cutoff = new Date(Date.now() - settings.autoNoShowAfterMinutes * 60_000);

      const result = await this.prisma.booking.updateMany({
        where: {
          tenantId,
          status: BookingStatus.CONFIRMED,
          scheduledAt: { lte: cutoff },
          checkedInAt: null,
        },
        data: {
          status: BookingStatus.NO_SHOW,
          noShowAt: new Date(),
        },
      });
      totalNoShow += result.count;
    }

    if (totalNoShow > 0) {
      this.logger.log(`[booking-noshow] marked ${totalNoShow} as NO_SHOW`);
    }
  }

  private async runAppointmentReminders(): Promise<void> {
    const waiting = await this.prisma.waitlistEntry.findMany({
      where: { status: WaitlistStatus.WAITING },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    if (waiting.length > 0) {
      this.logger.log(`[appointment-reminders] ${waiting.length} waitlist entries checked`);
    }
  }

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
