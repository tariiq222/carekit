import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { BookingsModule } from '../../modules/bookings/bookings.module';
import { OrgExperienceModule } from '../../modules/org-experience/org-experience.module';
import { PublicBrandingController } from './branding.controller';
import { PublicCatalogController } from './catalog.controller';
import { PublicSlotsController } from './slots.controller';

@Module({
  imports: [DatabaseModule, BookingsModule, OrgExperienceModule],
  controllers: [PublicBrandingController, PublicCatalogController, PublicSlotsController],
})
export class PublicModule {}
