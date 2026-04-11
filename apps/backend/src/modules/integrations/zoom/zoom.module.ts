import { Module } from '@nestjs/common';
import { ZoomService } from './zoom.service.js';

@Module({
  providers: [ZoomService],
  exports: [ZoomService],
})
export class ZoomModule {}
