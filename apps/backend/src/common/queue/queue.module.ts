import { Global, Module } from '@nestjs/common';
import { MessagingModule } from '../../modules/messaging/messaging.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { QueueFailureService } from './queue-failure.service.js';

@Global()
@Module({
  imports: [MessagingModule, MetricsModule],
  providers: [QueueFailureService],
  exports: [QueueFailureService],
})
export class QueueModule {}
