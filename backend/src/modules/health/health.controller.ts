import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';
import { RedisHealthIndicator } from './redis.health.js';
import { MinioHealthIndicator } from './minio.health.js';

const startedAt = Date.now();

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    private readonly prisma: PrismaService,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly minioHealth: MinioHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    const result = await this.health.check([
      () => this.checkDatabase(),
      () => this.redisHealth.check(),
      () => this.minioHealth.check(),
    ]);

    return {
      ...result,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.1',
      startedAt: new Date(startedAt).toISOString(),
    } as HealthCheckResult;
  }

  private async checkDatabase() {
    const session = this.indicator.check('database');

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return session.up();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      return session.down({ message });
    }
  }
}
