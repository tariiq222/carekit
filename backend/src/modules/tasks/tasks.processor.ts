import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CleanupService } from './cleanup.service.js';
import { ReminderService } from './reminder.service.js';
import { BookingAutomationService } from './booking-automation.service.js';
import { QueueFailureService } from '../../common/queue/queue-failure.service.js';
import { JOB_ATTEMPTS, QUEUE_TASKS } from '../../config/constants/queues.js';

@Processor(QUEUE_TASKS)
export class TasksProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(TasksProcessor.name);

  constructor(
    private readonly cleanupService: CleanupService,
    private readonly reminderService: ReminderService,
    private readonly bookingAutomationService: BookingAutomationService,
    private readonly queueFailureService: QueueFailureService,
  ) {
    super();
  }

  onModuleInit() {
    this.worker.on('failed', async (job, error) => {
      const isFinal =
        (job && job.attemptsMade >= (job.opts.attempts ?? JOB_ATTEMPTS)) ||
        error.name === 'UnrecoverableError';
      if (isFinal) {
        await this.queueFailureService.notifyAdminsOfFailure(
          QUEUE_TASKS,
          job?.name ?? 'unknown',
          job?.id,
          job?.data,
          error,
        );
      }
    });
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing task: ${job.name}`);

    switch (job.name) {
      case 'cleanup-otps':
        await this.cleanupService.cleanExpiredOtps();
        break;
      case 'cleanup-tokens':
        await this.cleanupService.cleanExpiredRefreshTokens();
        break;
      case 'reminder-24h':
        await this.reminderService.sendDayBeforeReminders();
        break;
      case 'reminder-1h':
        await this.reminderService.sendHourBeforeReminders();
        break;
      case 'expire-pending-bookings':
        await this.bookingAutomationService.expirePendingBookings();
        break;
      case 'auto-complete-bookings':
        await this.bookingAutomationService.autoCompleteBookings();
        break;
      case 'auto-no-show':
        await this.bookingAutomationService.autoNoShow();
        break;
      case 'expire-pending-cancellations':
        await this.bookingAutomationService.autoExpirePendingCancellations();
        break;
      case 'reminder-2h':
        await this.reminderService.sendTwoHourReminders();
        break;
      case 'reminder-15min':
        await this.reminderService.sendUrgentReminders();
        break;
      case 'cleanup-webhooks':
        await this.cleanupService.cleanOldProcessedWebhooks();
        break;
      case 'archive-activity-logs':
        await this.cleanupService.archiveOldActivityLogs();
        break;
      case 'repair-rating-cache':
        await this.cleanupService.repairPractitionerRatingCache();
        break;
      case 'db-snapshot':
        await this.cleanupService.logTableGrowthSnapshot();
        break;
      default:
        this.logger.warn(`Unknown task job: ${job.name}`);
    }
  }
}
