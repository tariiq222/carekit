import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ProblemReportsController } from './problem-reports.controller.js';
import { ProblemReportsService } from './problem-reports.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [ProblemReportsController],
  providers: [ProblemReportsService],
  exports: [ProblemReportsService],
})
export class ProblemReportsModule {}
