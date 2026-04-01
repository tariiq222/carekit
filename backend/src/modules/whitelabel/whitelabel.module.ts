import { Module } from '@nestjs/common';
import { WhitelabelController } from './whitelabel.controller.js';
import { WhitelabelService } from './whitelabel.service.js';
import { ClinicModule } from '../clinic/clinic.module.js';

@Module({
  imports: [ClinicModule],
  controllers: [WhitelabelController],
  providers: [WhitelabelService],
  exports: [WhitelabelService],
})
export class WhitelabelModule {}
