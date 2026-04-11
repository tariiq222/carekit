import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller.js';
import { PatientsService } from './patients.service.js';
import { PatientWalkInService } from './patient-walk-in.service.js';
import { ActivityLogModule } from '../activity-log/activity-log.module.js';

@Module({
  imports: [ActivityLogModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientWalkInService],
  exports: [PatientsService, PatientWalkInService],
})
export class PatientsModule {}
