import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';
import { DurationOptionsService } from './duration-options.service.js';
import { ServiceBookingTypeService } from './service-booking-type.service.js';

@Module({
  controllers: [ServicesController],
  providers: [ServicesService, DurationOptionsService, ServiceBookingTypeService],
  exports: [ServicesService, DurationOptionsService, ServiceBookingTypeService],
})
export class ServicesModule {}
