import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { BookingsModule } from '../../../modules/bookings/bookings.module';
import { PeopleModule } from '../../../modules/people/people.module';
import { FinanceModule } from '../../../modules/finance/finance.module';
import { AiModule } from '../../../modules/ai/ai.module';
import { CommsModule } from '../../../modules/comms/comms.module';
import { MobileClientBookingsController } from './bookings.controller';
import { MobileClientProfileController } from './profile.controller';
import { MobileClientPaymentsController } from './payments.controller';
import { MobileClientChatController } from './chat.controller';
import { MobileClientNotificationsController } from './notifications.controller';
import { MobileClientHomeController } from './portal/home.controller';
import { MobileClientUpcomingController } from './portal/upcoming.controller';
import { MobileClientSummaryController } from './portal/summary.controller';

@Module({
  imports: [DatabaseModule, BookingsModule, PeopleModule, FinanceModule, AiModule, CommsModule],
  controllers: [
    MobileClientBookingsController,
    MobileClientProfileController,
    MobileClientPaymentsController,
    MobileClientChatController,
    MobileClientNotificationsController,
    MobileClientHomeController,
    MobileClientUpcomingController,
    MobileClientSummaryController,
  ],
})
export class MobileClientModule {}
