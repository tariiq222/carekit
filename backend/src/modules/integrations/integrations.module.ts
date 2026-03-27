import { Module } from '@nestjs/common';
import { ZoomModule } from './zoom/zoom.module.js';

@Module({
  imports: [ZoomModule],
  exports: [ZoomModule],
})
export class IntegrationsModule {}
