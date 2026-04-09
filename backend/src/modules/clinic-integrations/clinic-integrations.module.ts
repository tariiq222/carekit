import { Module } from '@nestjs/common';
import { ClinicIntegrationsController } from './clinic-integrations.controller.js';
import { ClinicIntegrationsService } from './clinic-integrations.service.js';

@Module({
  controllers: [ClinicIntegrationsController],
  providers: [ClinicIntegrationsService],
  exports: [ClinicIntegrationsService],
})
export class ClinicIntegrationsModule {}
