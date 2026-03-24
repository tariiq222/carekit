import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { BookingSettingsController } from './booking-settings.controller.js';
import { WaitlistController } from './waitlist.controller.js';
import { BookingsService } from './bookings.service.js';
import { BookingCancellationService } from './booking-cancellation.service.js';
import { BookingCancelHelpersService } from './booking-cancel-helpers.service.js';
import { BookingQueryService } from './booking-query.service.js';
import { BookingRecurringService } from './booking-recurring.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { BookingStatusService } from './booking-status.service.js';
import { BookingPaymentHelper } from './booking-payment.helper.js';
import { BookingLookupHelper } from './booking-lookup.helper.js';
import { WaitlistService } from './waitlist.service.js';
import { ZoomModule } from '../integrations/zoom/zoom.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule, ZoomModule],
  controllers: [WaitlistController, BookingsController, BookingSettingsController],
  providers: [
    BookingsService,
    BookingQueryService,
    BookingCancellationService,
    BookingCancelHelpersService,
    BookingRecurringService,
    BookingSettingsService,
    BookingStatusService,
    BookingPaymentHelper,
    BookingLookupHelper,
    WaitlistService,
  ],
  exports: [BookingsService, BookingSettingsService, BookingStatusService, WaitlistService],
})
export class BookingsModule {}
