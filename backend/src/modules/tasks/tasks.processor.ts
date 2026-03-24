import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CleanupService } from './cleanup.service.js';
import { ReminderService } from './reminder.service.js';

@Processor('tasks')
export class TasksProcessor extends WorkerHost {
  private readonly logger = new Logger(TasksProcessor.name);

  constructor(
    private readonly cleanupService: CleanupService,
    private readonly reminderService: ReminderService,
  ) {
    super();
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
      default:
        this.logger.warn(`Unknown task job: ${job.name}`);
    }
  }
}
