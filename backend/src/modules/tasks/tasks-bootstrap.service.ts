import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_TASKS } from '../../config/constants/queues.js';

interface JobDefinition {
  name: string;
  pattern: string;
}

const DESIRED_JOBS: JobDefinition[] = [
  { name: 'cleanup-otps',                  pattern: '0 3 * * *'    },
  { name: 'cleanup-tokens',                pattern: '30 3 * * *'   },
  { name: 'reminder-24h',                  pattern: '0 * * * *'    },
  { name: 'reminder-1h',                   pattern: '*/15 * * * *' },
  { name: 'expire-pending-bookings',       pattern: '*/5 * * * *'  },
  { name: 'auto-complete-bookings',        pattern: '*/15 * * * *' },
  { name: 'auto-no-show',                  pattern: '*/10 * * * *' },
  { name: 'expire-pending-cancellations',  pattern: '0 * * * *'    },
  { name: 'reminder-2h',                   pattern: '*/15 * * * *' },
  { name: 'reminder-15min',                pattern: '*/5 * * * *'  },
  { name: 'cleanup-webhooks',              pattern: '0 4 * * *'    },
  { name: 'archive-activity-logs',         pattern: '0 5 * * 0'    },
  { name: 'repair-rating-cache',           pattern: '0 6 * * 0'    },
  { name: 'db-snapshot',                   pattern: '0 0 * * 0'    },
];

@Injectable()
export class TasksBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TasksBootstrapService.name);

  constructor(@InjectQueue(QUEUE_TASKS) private readonly tasksQueue: Queue) {}

  async onModuleInit() {
    const existing = await this.tasksQueue.getRepeatableJobs();
    const existingNames = new Set(existing.map((j) => j.name));
    const desiredNames = new Set(DESIRED_JOBS.map((j) => j.name));

    // Remove stale jobs no longer in the desired set
    let removed = 0;
    for (const job of existing) {
      if (!desiredNames.has(job.name)) {
        await this.tasksQueue.removeRepeatableByKey(job.key);
        this.logger.log(`Removed stale job: ${job.name}`);
        removed++;
      }
    }

    // Register only jobs that are not already present
    let registered = 0;
    for (const job of DESIRED_JOBS) {
      if (!existingNames.has(job.name)) {
        await this.tasksQueue.add(job.name, {}, {
          repeat: { pattern: job.pattern },
          removeOnComplete: true,
        });
        registered++;
      }
    }

    this.logger.log(`Tasks bootstrap: ${registered} new jobs registered, ${removed} stale removed`);
  }
}
