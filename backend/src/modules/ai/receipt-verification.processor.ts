import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReceiptVerificationService } from './receipt-verification.service.js';

@Processor('receipt-verification')
export class ReceiptVerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReceiptVerificationProcessor.name);

  constructor(
    private readonly receiptVerificationService: ReceiptVerificationService,
  ) {
    super();
  }

  async process(job: Job<{ receiptId: string }>): Promise<void> {
    if (job.name === 'verify') {
      this.logger.log(`Processing receipt verification job ${job.id} for receipt ${job.data.receiptId}`);
      await this.receiptVerificationService.verifyReceipt(job.data.receiptId);
      this.logger.log(`Completed receipt verification job ${job.id}`);
    }
  }
}
