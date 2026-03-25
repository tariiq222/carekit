import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CleanupService } from './cleanup.service.js';
import { ReminderService } from './reminder.service.js';
import { BookingAutomationService } from './booking-automation.service.js';
import { BookingExpiryService } from './booking-expiry.service.js';
import { BookingAutocompleteService } from './booking-autocomplete.service.js';
import { BookingNoShowService } from './booking-noshow.service.js';
import { BookingCancellationTimeoutService } from './booking-cancellation-timeout.service.js';
import { TasksProcessor } from './tasks.processor.js';
import { TasksBootstrapService } from './tasks-bootstrap.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { DEFAULT_JOB_OPTIONS, QUEUE_TASKS } from '../../config/constants/queues.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_TASKS, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    NotificationsModule,
    BookingsModule,
  ],
  providers: [
    CleanupService,
    ReminderService,
    BookingExpiryService,
    BookingAutocompleteService,
    BookingNoShowService,
    BookingCancellationTimeoutService,
    BookingAutomationService,
    TasksProcessor,
    TasksBootstrapService,
  ],
})
export class TasksModule {}
