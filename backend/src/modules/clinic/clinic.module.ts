import { Module } from '@nestjs/common';
import { ClinicHoursService } from './clinic-hours.service.js';
import { ClinicHoursController } from './clinic-hours.controller.js';
import { ClinicHolidaysService } from './clinic-holidays.service.js';
import { ClinicHolidaysController } from './clinic-holidays.controller.js';
import { ClinicSettingsService } from './clinic-settings.service.js';
import { ClinicSettingsController } from './clinic-settings.controller.js';

@Module({
  controllers: [ClinicHoursController, ClinicHolidaysController, ClinicSettingsController],
  providers: [ClinicHoursService, ClinicHolidaysService, ClinicSettingsService],
  exports: [ClinicHoursService, ClinicHolidaysService, ClinicSettingsService],
})
export class ClinicModule {}
