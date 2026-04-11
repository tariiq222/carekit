import { Global, Module } from '@nestjs/common';
import { NotificationsModule } from '../../modules/notifications/notifications.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { QueueFailureService } from './queue-failure.service.js';

@Global()
@Module({
  imports: [NotificationsModule, MetricsModule],
  providers: [QueueFailureService],
  exports: [QueueFailureService],
})
export class QueueModule {}
