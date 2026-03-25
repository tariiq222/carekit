import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller.js';
import { PatientsService } from './patients.service.js';
import { PatientWalkInService } from './patient-walk-in.service.js';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, PatientWalkInService],
  exports: [PatientsService, PatientWalkInService],
})
export class PatientsModule {}
