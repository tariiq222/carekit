import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheckHandler, HealthCheckResult } from '../../modules/ops/health-check/health-check.handler';

@ApiTags('Public / Health')
@Controller('health')
export class PublicHealthController {
  constructor(private readonly healthCheck: HealthCheckHandler) {}

  @Get()
  @ApiOperation({ summary: 'Platform health check (DB, Redis, BullMQ)' })
  check(): Promise<HealthCheckResult> {
    return this.healthCheck.execute();
  }
}
