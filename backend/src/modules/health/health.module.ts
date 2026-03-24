import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { RedisHealthIndicator } from './redis.health.js';
import { MinioHealthIndicator } from './minio.health.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, MinioHealthIndicator],
})
export class HealthModule {}
