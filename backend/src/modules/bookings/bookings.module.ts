import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { BookingActionsController } from './booking-actions.controller.js';
import { BookingSettingsController } from './booking-settings.controller.js';
import { WaitlistController } from './waitlist.controller.js';
import { BookingStatusLogController } from './booking-status-log.controller.js';
import { BookingsService } from './bookings.service.js';
import { BookingCancellationService } from './booking-cancellation.service.js';
import { BookingCancelHelpersService } from './booking-cancel-helpers.service.js';
import { BookingQueryService } from './booking-query.service.js';
import { BookingRecurringService } from './booking-recurring.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { BookingStatusService } from './booking-status.service.js';
import { BookingStatusLogService } from './booking-status-log.service.js';
import { BookingPaymentHelper } from './booking-payment.helper.js';
import { BookingLookupHelper } from './booking-lookup.helper.js';
import { PriceResolverService } from './price-resolver.service.js';
import { BookingRescheduleService } from './booking-reschedule.service.js';
import { BookingCreationService } from './booking-creation.service.js';
import { WaitlistService } from './waitlist.service.js';
import { ZoomModule } from '../integrations/zoom/zoom.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ClinicModule } from '../clinic/clinic.module.js';
import { ActivityLogModule } from '../activity-log/activity-log.module.js';

@Module({
  imports: [NotificationsModule, ZoomModule, ClinicModule, ActivityLogModule],
  controllers: [WaitlistController, BookingsController, BookingActionsController, BookingSettingsController, BookingStatusLogController],
  providers: [
    BookingsService,
    BookingCreationService,
    BookingQueryService,
    BookingCancellationService,
    BookingCancelHelpersService,
    BookingRecurringService,
    BookingSettingsService,
    BookingStatusService,
    BookingStatusLogService,
    BookingPaymentHelper,
    BookingLookupHelper,
    PriceResolverService,
    BookingRescheduleService,
    WaitlistService,
  ],
  exports: [BookingsService, BookingSettingsService, BookingStatusService, BookingStatusLogService, PriceResolverService, WaitlistService],
})
export class BookingsModule {}
