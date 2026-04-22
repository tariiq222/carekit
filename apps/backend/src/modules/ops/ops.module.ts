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
// Billing crons (SaaS-04 Task 9)
import { MeterUsageCron } from '../platform/billing/meter-usage/meter-usage.cron';
import { ChargeDueSubscriptionsCron } from '../platform/billing/charge-due-subscriptions/charge-due-subscriptions.cron';
import { ComputeOverageCron } from '../platform/billing/compute-overage/compute-overage.cron';
import { EnforceGracePeriodCron } from '../platform/billing/enforce-grace-period/enforce-grace-period.cron';
import { ExpireImpersonationSessionsCron } from '../platform/admin/expire-impersonation-sessions/expire-impersonation-sessions.cron';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { UsageAggregatorService } from '../platform/billing/usage-aggregator.service';
import { SubscriptionStateMachine } from '../platform/billing/subscription-state-machine';
import { SubscriptionCacheService } from '../platform/billing/subscription-cache.service';

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
  // Billing crons
  MeterUsageCron,
  ChargeDueSubscriptionsCron,
  ComputeOverageCron,
  EnforceGracePeriodCron,
  // Admin crons
  ExpireImpersonationSessionsCron,
];

const billingServices = [
  UsageAggregatorService,
  SubscriptionStateMachine,
  SubscriptionCacheService,
];

@Module({
  imports: [DatabaseModule, MessagingModule, TerminusModule, BookingsModule],
  controllers: [DashboardOpsController],
  providers: [...handlers, ...cronHandlers, ...billingServices, RedisService, CronTasksService],
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
