import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { CreateBookingHandler } from './create-booking/create-booking.handler';
import { CancelBookingHandler } from './cancel-booking/cancel-booking.handler';
import { RescheduleBookingHandler } from './reschedule-booking/reschedule-booking.handler';
import { ConfirmBookingHandler } from './confirm-booking/confirm-booking.handler';
import { AddToWaitlistHandler } from './add-to-waitlist/add-to-waitlist.handler';
import { GetBookingHandler } from './get-booking/get-booking.handler';
import { ListBookingsHandler } from './list-bookings/list-bookings.handler';
import { CheckAvailabilityHandler } from './check-availability/check-availability.handler';
import { CheckInBookingHandler } from './check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from './complete-booking/complete-booking.handler';
import { NoShowBookingHandler } from './no-show-booking/no-show-booking.handler';
import { ExpireBookingHandler } from './expire-booking/expire-booking.handler';
import { PaymentCompletedEventHandler } from './payment-completed-handler/payment-completed.handler';

const handlers = [
  CreateBookingHandler,
  CancelBookingHandler,
  RescheduleBookingHandler,
  ConfirmBookingHandler,
  AddToWaitlistHandler,
  GetBookingHandler,
  ListBookingsHandler,
  CheckAvailabilityHandler,
  CheckInBookingHandler,
  CompleteBookingHandler,
  NoShowBookingHandler,
  ExpireBookingHandler,
];

@Module({
  imports: [DatabaseModule, MessagingModule],
  providers: [...handlers, PaymentCompletedEventHandler],
  exports: [...handlers],
})
export class BookingsModule implements OnModuleInit {
  constructor(private readonly paymentCompletedHandler: PaymentCompletedEventHandler) {}

  onModuleInit(): void {
    this.paymentCompletedHandler.register();
  }
}
