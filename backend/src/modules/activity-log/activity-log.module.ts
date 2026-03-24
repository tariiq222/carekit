import { Global, Module } from '@nestjs/common';
import { ActivityLogController } from './activity-log.controller.js';
import { ActivityLogService } from './activity-log.service.js';

@Global()
@Module({
  controllers: [ActivityLogController],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
