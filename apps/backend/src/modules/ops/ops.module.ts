import { Module, OnModuleInit } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { CronTasksService } from './cron-tasks/cron-tasks.service';
import { LogActivityHandler } from './log-activity/log-activity.handler';
import { ListActivityHandler } from './log-activity/list-activity.handler';
import { GenerateReportHandler } from './generate-report/generate-report.handler';
import { HealthCheckHandler } from './health-check/health-check.handler';

const handlers = [
  LogActivityHandler,
  ListActivityHandler,
  GenerateReportHandler,
  HealthCheckHandler,
];

@Module({
  imports: [DatabaseModule, MessagingModule, TerminusModule],
  providers: [...handlers, CronTasksService],
  exports: [...handlers],
})
export class OpsModule implements OnModuleInit {
  constructor(private readonly cronTasks: CronTasksService) {}

  onModuleInit(): void {
    // CronTasksService.onModuleInit() handles job scheduling + worker registration.
    // Explicitly called here to document the lifecycle dependency.
    void this.cronTasks;
  }
}
