import { Module } from '@nestjs/common';
import { ClinicHoursService } from './clinic-hours.service.js';
import { ClinicHoursController } from './clinic-hours.controller.js';
import { ClinicHolidaysService } from './clinic-holidays.service.js';
import { ClinicHolidaysController } from './clinic-holidays.controller.js';

@Module({
  controllers: [ClinicHoursController, ClinicHolidaysController],
  providers: [ClinicHoursService, ClinicHolidaysService],
  exports: [ClinicHoursService, ClinicHolidaysService],
})
export class ClinicModule {}
