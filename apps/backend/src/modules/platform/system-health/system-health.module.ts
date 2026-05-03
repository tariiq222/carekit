import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { GetSystemHealthHandler } from './get-system-health/get-system-health.handler';

@Module({
  imports: [DatabaseModule],
  providers: [GetSystemHealthHandler],
  exports: [GetSystemHealthHandler],
})
export class SystemHealthModule {}
