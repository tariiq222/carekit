import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TasksBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TasksBootstrapService.name);

  constructor(@InjectQueue('tasks') private readonly tasksQueue: Queue) {}

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
      removeOnFail: 5,
    });

    await this.tasksQueue.add('cleanup-tokens', {}, {
      repeat: { pattern: '30 3 * * *' }, // Daily at 3:30 AM
      removeOnComplete: true,
      removeOnFail: 5,
    });

    await this.tasksQueue.add('reminder-24h', {}, {
      repeat: { pattern: '0 * * * *' }, // Every hour
      removeOnComplete: true,
      removeOnFail: 5,
    });

    await this.tasksQueue.add('reminder-1h', {}, {
      repeat: { pattern: '*/15 * * * *' }, // Every 15 minutes
      removeOnComplete: true,
      removeOnFail: 5,
    });

    this.logger.log('Registered 4 repeatable task jobs');
  }
}
