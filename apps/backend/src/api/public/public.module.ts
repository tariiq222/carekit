import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { BookingsModule } from '../../modules/bookings/bookings.module';
import { OrgExperienceModule } from '../../modules/org-experience/org-experience.module';
import { IdentityModule } from '../../modules/identity/identity.module';
import { PeopleModule } from '../../modules/people/people.module';
import { CommsModule } from '../../modules/comms/comms.module';
import { FinanceModule } from '../../modules/finance/finance.module';
import { AuthController } from './auth.controller';
import { PublicAuthController } from './public-auth.controller';
import { PublicBrandingController } from './branding.controller';
import { PublicCatalogController } from './catalog.controller';
import { PublicSlotsController } from './slots.controller';
import { PublicEmployeesController } from './employees.controller';
import { PublicContactMessagesController } from './contact-messages.controller';
import { PublicOtpController } from './otp.controller';
import { PublicAvailabilityController } from './availability.controller';
import { PublicBookingsController } from './bookings.controller';
import { PublicPaymentsController } from './payments.controller';
import { PublicBranchesController } from './branches.controller';
import { OrgConfigModule } from '../../modules/org-config/org-config.module';

@Module({
  imports: [DatabaseModule, BookingsModule, OrgExperienceModule, IdentityModule, PeopleModule, CommsModule, FinanceModule, OrgConfigModule],
  controllers: [AuthController, PublicAuthController, PublicBrandingController, PublicCatalogController, PublicSlotsController, PublicEmployeesController, PublicContactMessagesController, PublicOtpController, PublicAvailabilityController, PublicBookingsController, PublicPaymentsController, PublicBranchesController],
})
export class PublicModule {}
