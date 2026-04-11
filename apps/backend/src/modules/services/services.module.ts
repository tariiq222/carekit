import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';
import { ServicesAvatarService } from './services-avatar.service.js';
import { ServiceCategoriesService } from './service-categories.service.js';
import { DurationOptionsService } from './duration-options.service.js';
import { ServiceBookingTypeService } from './service-booking-type.service.js';
import { ServicePractitionersService } from './service-practitioners.service.js';
import { IntakeFormsModule } from '../intake-forms/intake-forms.module.js';
import { StorageModule } from '../../common/storage.module.js';

@Module({
  imports: [IntakeFormsModule, StorageModule],
  controllers: [ServicesController],
  providers: [
    ServicesService,
    ServicesAvatarService,
    ServiceCategoriesService,
    DurationOptionsService,
    ServiceBookingTypeService,
    ServicePractitionersService,
  ],
  exports: [
    ServicesService,
    ServiceCategoriesService,
    DurationOptionsService,
    ServiceBookingTypeService,
    ServicePractitionersService,
  ],
})
export class ServicesModule {}
