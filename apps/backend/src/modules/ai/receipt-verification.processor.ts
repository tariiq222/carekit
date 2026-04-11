import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReceiptVerificationService } from './receipt-verification.service.js';
import { QueueFailureService } from '../../common/queue/queue-failure.service.js';
import {
  JOB_ATTEMPTS,
  QUEUE_RECEIPT_VERIFICATION,
} from '../../config/constants/queues.js';

@Processor(QUEUE_RECEIPT_VERIFICATION)
export class ReceiptVerificationProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(ReceiptVerificationProcessor.name);

  constructor(
    private readonly receiptVerificationService: ReceiptVerificationService,
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
          QUEUE_RECEIPT_VERIFICATION,
          job?.name ?? 'unknown',
          job?.id,
          job?.data,
          error,
        );
      }
    });
  }

  async process(job: Job<{ receiptId: string }>): Promise<void> {
    if (job.name === 'verify') {
      this.logger.log(
        `Processing receipt verification job ${job.id} for receipt ${job.data.receiptId}`,
      );
      await this.receiptVerificationService.verifyReceipt(job.data.receiptId);
      this.logger.log(`Completed receipt verification job ${job.id}`);
    }
  }
}
