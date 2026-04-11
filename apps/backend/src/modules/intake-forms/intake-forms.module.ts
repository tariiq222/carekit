import { Module } from '@nestjs/common';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module.js';
import { IntakeFormsController } from './intake-forms.controller.js';
import { IntakeFormsService } from './intake-forms.service.js';

@Module({
  imports: [FeatureFlagsModule],
  controllers: [IntakeFormsController],
  providers: [IntakeFormsService],
  exports: [IntakeFormsService],
})
export class IntakeFormsModule {}
