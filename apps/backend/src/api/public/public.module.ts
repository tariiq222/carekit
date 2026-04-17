import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { BookingsModule } from '../../modules/bookings/bookings.module';
import { OrgExperienceModule } from '../../modules/org-experience/org-experience.module';
import { IdentityModule } from '../../modules/identity/identity.module';
import { PeopleModule } from '../../modules/people/people.module';
import { CommsModule } from '../../modules/comms/comms.module';
import { AuthController } from './auth.controller';
import { PublicBrandingController } from './branding.controller';
import { PublicCatalogController } from './catalog.controller';
import { PublicSlotsController } from './slots.controller';
import { PublicEmployeesController } from './employees.controller';
import { PublicContactMessagesController } from './contact-messages.controller';

@Module({
  imports: [DatabaseModule, BookingsModule, OrgExperienceModule, IdentityModule, PeopleModule, CommsModule],
  controllers: [AuthController, PublicBrandingController, PublicCatalogController, PublicSlotsController, PublicEmployeesController, PublicContactMessagesController],
})
export class PublicModule {}
