import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupService } from './cleanup.service.js';
import { ReminderService } from './reminder.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [ScheduleModule.forRoot(), NotificationsModule],
  providers: [CleanupService, ReminderService],
})
export class TasksModule {}
