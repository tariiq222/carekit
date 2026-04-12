import { Module, OnModuleInit } from '@nestjs/common';
import { DashboardOpsController } from '../../api/dashboard/ops.controller';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CronTasksService } from './cron-tasks/cron-tasks.service';
import { BookingAutocompleteCron } from './cron-tasks/booking-autocomplete.cron';
import { BookingExpiryCron } from './cron-tasks/booking-expiry.cron';
import { BookingNoShowCron } from './cron-tasks/booking-noshow.cron';
import { AppointmentRemindersCron } from './cron-tasks/appointment-reminders.cron';
import { GroupSessionAutomationCron } from './cron-tasks/group-session-automation.cron';
import { RefreshTokenCleanupCron } from './cron-tasks/refresh-token-cleanup.cron';
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

const cronHandlers = [
  BookingAutocompleteCron,
  BookingExpiryCron,
  BookingNoShowCron,
  AppointmentRemindersCron,
  GroupSessionAutomationCron,
  RefreshTokenCleanupCron,
];

@Module({
  imports: [DatabaseModule, MessagingModule, TerminusModule, BookingsModule],
  controllers: [DashboardOpsController],
  providers: [...handlers, ...cronHandlers, CronTasksService],
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
