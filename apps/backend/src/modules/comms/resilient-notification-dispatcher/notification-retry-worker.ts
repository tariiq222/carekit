// BullMQ worker that processes notification-retry jobs.
// Registered once on module init — retries failed CRITICAL channel sends.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import {
  NOTIFICATION_RETRY_QUEUE,
  ResilientNotificationDispatcher,
  type RetryJobData,
} from './resilient-notification-dispatcher.service';

@Injectable()
export class NotificationRetryWorker implements OnModuleInit {
  private readonly logger = new Logger(NotificationRetryWorker.name);

  constructor(
    private readonly bullmq: BullMqService,
    private readonly dispatcher: ResilientNotificationDispatcher,
  ) {}

  onModuleInit(): void {
    this.bullmq.createWorker<RetryJobData>(
      NOTIFICATION_RETRY_QUEUE,
      async (job) => {
        const { logId, channel, payload, attempt } = job.data;
        this.logger.log(
          `Retrying [${channel}] delivery for log ${logId} (attempt #${attempt})`,
        );
        await this.dispatcher.attemptSend(logId, channel, payload, attempt);
      },
    );
    this.logger.log(`Worker registered for queue: ${NOTIFICATION_RETRY_QUEUE}`);
  }
}
