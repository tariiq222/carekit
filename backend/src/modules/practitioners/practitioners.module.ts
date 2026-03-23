import { Module } from '@nestjs/common';
import { PractitionersController } from './practitioners.controller.js';
import { PractitionersService } from './practitioners.service.js';
import { PractitionerAvailabilityService } from './practitioner-availability.service.js';
import { PractitionerVacationService } from './practitioner-vacation.service.js';
import { PractitionerServiceService } from './practitioner-service.service.js';

@Module({
  controllers: [PractitionersController],
  providers: [
    PractitionersService,
    PractitionerAvailabilityService,
    PractitionerVacationService,
    PractitionerServiceService,
  ],
  exports: [PractitionersService, PractitionerServiceService],
})
export class PractitionersModule {}
