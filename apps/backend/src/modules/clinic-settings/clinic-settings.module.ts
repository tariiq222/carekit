import { Module } from '@nestjs/common';
import { ClinicSettingsController } from './clinic-settings.controller.js';
import { ClinicSettingsService } from './clinic-settings.service.js';
import { ThemeController } from './theme.controller.js';
import { ThemeService } from './theme.service.js';

@Module({
  controllers: [ClinicSettingsController, ThemeController],
  providers: [ClinicSettingsService, ThemeService],
  exports: [ClinicSettingsService, ThemeService],
})
export class ClinicSettingsModule {}
