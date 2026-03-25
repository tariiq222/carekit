import { Module } from '@nestjs/common';
import { IntakeFormsController } from './intake-forms.controller.js';
import { IntakeFormsService } from './intake-forms.service.js';

@Module({
  controllers: [IntakeFormsController],
  providers: [IntakeFormsService],
  exports: [IntakeFormsService],
})
export class IntakeFormsModule {}
