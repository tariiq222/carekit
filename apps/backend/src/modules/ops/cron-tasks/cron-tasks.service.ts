import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { BookingAutocompleteCron } from './booking-autocomplete.cron';
import { BookingExpiryCron } from './booking-expiry.cron';
import { BookingNoShowCron } from './booking-noshow.cron';
import { AppointmentRemindersCron } from './appointment-reminders.cron';
import { GroupSessionAutomationCron } from './group-session-automation.cron';
import { RefreshTokenCleanupCron } from './refresh-token-cleanup.cron';

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
    private readonly bookingAutocomplete: BookingAutocompleteCron,
    private readonly bookingExpiry: BookingExpiryCron,
    private readonly bookingNoShow: BookingNoShowCron,
    private readonly appointmentReminders: AppointmentRemindersCron,
    private readonly groupSessionAutomation: GroupSessionAutomationCron,
    private readonly refreshTokenCleanup: RefreshTokenCleanupCron,
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
          await this.bookingAutocomplete.execute();
          break;
        case CRON_JOBS.BOOKING_EXPIRY:
          await this.bookingExpiry.execute();
          break;
        case CRON_JOBS.BOOKING_NOSHOW:
          await this.bookingNoShow.execute();
          break;
        case CRON_JOBS.APPOINTMENT_REMINDERS:
          await this.appointmentReminders.execute();
          break;
        case CRON_JOBS.GROUP_SESSION_AUTOMATION:
          await this.groupSessionAutomation.execute();
          break;
        case CRON_JOBS.REFRESH_TOKEN_CLEANUP:
          await this.refreshTokenCleanup.execute();
          break;
        default:
          this.logger.warn(`Unknown cron job: ${job.name}`);
      }
    });
  }
}
