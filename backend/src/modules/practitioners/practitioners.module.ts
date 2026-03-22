import { Module } from '@nestjs/common';
import { PractitionersController } from './practitioners.controller.js';
import { PractitionersService } from './practitioners.service.js';
import { PractitionerAvailabilityService } from './practitioner-availability.service.js';
import { PractitionerVacationService } from './practitioner-vacation.service.js';

@Module({
  controllers: [PractitionersController],
  providers: [
    PractitionersService,
    PractitionerAvailabilityService,
    PractitionerVacationService,
  ],
  exports: [PractitionersService],
})
export class PractitionersModule {}
