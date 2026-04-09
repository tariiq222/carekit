import { Module } from '@nestjs/common';
import { FavoritePractitionersController } from './favorite-practitioners.controller.js';
import { PractitionersController } from './practitioners.controller.js';
import { PractitionersService } from './practitioners.service.js';
import { PractitionerAvailabilityService } from './practitioner-availability.service.js';
import { PractitionerVacationService } from './practitioner-vacation.service.js';
import { PractitionerServiceService } from './practitioner-service.service.js';
import { PractitionerRatingsService } from './practitioner-ratings.service.js';
import { PractitionerBreaksService } from './practitioner-breaks.service.js';
import { FavoritePractitionersService } from './favorite-practitioners.service.js';
import { PractitionerOnboardingService } from './practitioner-onboarding.service.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { ClinicSettingsModule } from '../clinic-settings/clinic-settings.module.js';

@Module({
  imports: [BookingsModule, AuthModule, EmailModule, ClinicSettingsModule],
  controllers: [FavoritePractitionersController, PractitionersController],
  providers: [
    PractitionersService,
    PractitionerAvailabilityService,
    PractitionerVacationService,
    PractitionerBreaksService,
    PractitionerServiceService,
    PractitionerRatingsService,
    FavoritePractitionersService,
    PractitionerOnboardingService,
  ],
  exports: [PractitionersService, PractitionerServiceService],
})
export class PractitionersModule {}
