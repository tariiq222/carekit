import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.checkDatabase()]);
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' as const } };
    } catch {
      return { database: { status: 'down' as const } };
    }
  }
}
