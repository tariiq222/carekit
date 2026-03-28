import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';
import { DurationOptionsService } from './duration-options.service.js';
import { ServiceBookingTypeService } from './service-booking-type.service.js';
import { ServicePractitionersService } from './service-practitioners.service.js';
import { IntakeFormsModule } from '../intake-forms/intake-forms.module.js';

@Module({
  imports: [IntakeFormsModule],
  controllers: [ServicesController],
  providers: [ServicesService, DurationOptionsService, ServiceBookingTypeService, ServicePractitionersService],
  exports: [ServicesService, DurationOptionsService, ServiceBookingTypeService, ServicePractitionersService],
})
export class ServicesModule {}
