import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CleanupService } from './cleanup.service.js';
import { ReminderService } from './reminder.service.js';
import { TasksProcessor } from './tasks.processor.js';
import { TasksBootstrapService } from './tasks-bootstrap.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'tasks' }),
    NotificationsModule,
  ],
  providers: [
    CleanupService,
    ReminderService,
    TasksProcessor,
    TasksBootstrapService,
  ],
})
export class TasksModule {}
