import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_TASKS } from '../../config/constants/queues.js';

@Injectable()
export class TasksBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TasksBootstrapService.name);

  constructor(@InjectQueue(QUEUE_TASKS) private readonly tasksQueue: Queue) {}

  async onModuleInit() {
    // Remove any old repeatable jobs first to avoid duplicates
    const existingRepeatables = await this.tasksQueue.getRepeatableJobs();
    for (const job of existingRepeatables) {
      await this.tasksQueue.removeRepeatableByKey(job.key);
    }

    // Register repeatable jobs
    await this.tasksQueue.add('cleanup-otps', {}, {
      repeat: { pattern: '0 3 * * *' }, // Daily at 3:00 AM
      removeOnComplete: true,
    });

    await this.tasksQueue.add('cleanup-tokens', {}, {
      repeat: { pattern: '30 3 * * *' }, // Daily at 3:30 AM
      removeOnComplete: true,
    });

    await this.tasksQueue.add('reminder-24h', {}, {
      repeat: { pattern: '0 * * * *' }, // Every hour
      removeOnComplete: true,
    });

    await this.tasksQueue.add('reminder-1h', {}, {
      repeat: { pattern: '*/15 * * * *' }, // Every 15 minutes
      removeOnComplete: true,
    });

    await this.tasksQueue.add('expire-pending-bookings', {}, {
      repeat: { pattern: '*/5 * * * *' }, // Every 5 minutes
      removeOnComplete: true,
    });

    await this.tasksQueue.add('auto-complete-bookings', {}, {
      repeat: { pattern: '*/15 * * * *' }, // Every 15 minutes
      removeOnComplete: true,
    });

    await this.tasksQueue.add('auto-no-show', {}, {
      repeat: { pattern: '*/10 * * * *' }, // Every 10 minutes
      removeOnComplete: true,
    });

    await this.tasksQueue.add('expire-pending-cancellations', {}, {
      repeat: { pattern: '0 * * * *' }, // Every hour
      removeOnComplete: true,
    });

    await this.tasksQueue.add('reminder-2h', {}, {
      repeat: { pattern: '*/15 * * * *' }, // Every 15 minutes
      removeOnComplete: true,
    });

    await this.tasksQueue.add('reminder-15min', {}, {
      repeat: { pattern: '*/5 * * * *' }, // Every 5 minutes
      removeOnComplete: true,
    });

    this.logger.log('Registered 10 repeatable task jobs');
  }
}
