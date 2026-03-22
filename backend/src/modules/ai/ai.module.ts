import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReceiptVerificationService } from './receipt-verification.service.js';
import { ReceiptVerificationProcessor } from './receipt-verification.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'receipt-verification',
    }),
  ],
  providers: [ReceiptVerificationService, ReceiptVerificationProcessor],
  exports: [
    ReceiptVerificationService,
    BullModule.registerQueue({ name: 'receipt-verification' }),
  ],
})
export class AiModule {}
