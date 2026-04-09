import { Module } from '@nestjs/common';
import { ClinicSettingsController } from './clinic-settings.controller.js';
import { ClinicSettingsService } from './clinic-settings.service.js';

@Module({
  controllers: [ClinicSettingsController],
  providers: [ClinicSettingsService],
  exports: [ClinicSettingsService],
})
export class ClinicSettingsModule {}
