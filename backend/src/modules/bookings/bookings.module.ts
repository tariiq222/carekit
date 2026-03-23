import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { BookingCancellationService } from './booking-cancellation.service.js';
import { ZoomService } from './zoom.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    BookingCancellationService,
    { provide: 'ZoomService', useClass: ZoomService },
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
