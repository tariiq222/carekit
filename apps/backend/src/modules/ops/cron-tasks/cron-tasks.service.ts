import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { BookingAutocompleteCron } from './booking-autocomplete.cron';
import { BookingExpiryCron } from './booking-expiry.cron';
import { BookingNoShowCron } from './booking-noshow.cron';
import { AppointmentRemindersCron } from './appointment-reminders.cron';
import { GroupSessionAutomationCron } from './group-session-automation.cron';
import { RefreshTokenCleanupCron } from './refresh-token-cleanup.cron';
import { MeterUsageCron } from '../../platform/billing/meter-usage/meter-usage.cron';
import { ChargeDueSubscriptionsCron } from '../../platform/billing/charge-due-subscriptions/charge-due-subscriptions.cron';
import { ComputeOverageCron } from '../../platform/billing/compute-overage/compute-overage.cron';
import { EnforceGracePeriodCron } from '../../platform/billing/enforce-grace-period/enforce-grace-period.cron';
import { ExpireImpersonationSessionsCron } from '../../platform/admin/expire-impersonation-sessions/expire-impersonation-sessions.cron';

const QUEUE_NAME = 'ops-cron';

export const CRON_JOBS = {
  BOOKING_AUTOCOMPLETE: 'booking-autocomplete',
  BOOKING_EXPIRY: 'booking-expiry',
  BOOKING_NOSHOW: 'booking-noshow',
  APPOINTMENT_REMINDERS: 'appointment-reminders',
  GROUP_SESSION_AUTOMATION: 'group-session-automation',
  REFRESH_TOKEN_CLEANUP: 'refresh-token-cleanup',
  METER_USAGE: 'meter-usage',
  CHARGE_DUE_SUBSCRIPTIONS: 'charge-due-subscriptions',
  ENFORCE_GRACE_PERIOD: 'enforce-grace-period',
  EXPIRE_IMPERSONATION_SESSIONS: 'expire-impersonation-sessions',
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
    private readonly meterUsage: MeterUsageCron,
    private readonly chargeDueSubscriptions: ChargeDueSubscriptionsCron,
    private readonly computeOverage: ComputeOverageCron,
    private readonly enforceGracePeriod: EnforceGracePeriodCron,
    private readonly expireImpersonationSessions: ExpireImpersonationSessionsCron,
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
      { name: CRON_JOBS.METER_USAGE, cron: '0 2 * * *' },           // daily at 02:00 AST
      { name: CRON_JOBS.CHARGE_DUE_SUBSCRIPTIONS, cron: '0 * * * *' }, // hourly
      { name: CRON_JOBS.ENFORCE_GRACE_PERIOD, cron: '0 * * * *' },   // hourly
      { name: CRON_JOBS.EXPIRE_IMPERSONATION_SESSIONS, cron: '* * * * *' }, // every minute
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
        case CRON_JOBS.METER_USAGE:
          await this.meterUsage.execute();
          break;
        case CRON_JOBS.CHARGE_DUE_SUBSCRIPTIONS:
          await this.chargeDueSubscriptions.execute();
          break;
        case CRON_JOBS.ENFORCE_GRACE_PERIOD:
          await this.enforceGracePeriod.execute();
          break;
        case CRON_JOBS.EXPIRE_IMPERSONATION_SESSIONS:
          await this.expireImpersonationSessions.execute();
          break;
        default:
          this.logger.warn(`Unknown cron job: ${job.name}`);
      }
    });
  }

  /** Expose ComputeOverageCron for use by other billing crons in the same process. */
  getComputeOverage(): ComputeOverageCron {
    return this.computeOverage;
  }
}
