import { Module } from '@nestjs/common';
import { WhitelabelController } from './whitelabel.controller.js';
import { WhitelabelService } from './whitelabel.service.js';

@Module({
  controllers: [WhitelabelController],
  providers: [WhitelabelService],
  exports: [WhitelabelService],
})
export class WhitelabelModule {}
