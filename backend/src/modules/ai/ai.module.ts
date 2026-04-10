import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReceiptVerificationService } from './receipt-verification.service.js';
import { ReceiptVerificationProcessor } from './receipt-verification.processor.js';
import {
  DEFAULT_JOB_OPTIONS,
  QUEUE_RECEIPT_VERIFICATION,
} from '../../config/constants/queues.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_RECEIPT_VERIFICATION,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),
  ],
  providers: [ReceiptVerificationService, ReceiptVerificationProcessor],
  exports: [
    ReceiptVerificationService,
    BullModule.registerQueue({
      name: QUEUE_RECEIPT_VERIFICATION,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),
  ],
})
export class AiModule {}
