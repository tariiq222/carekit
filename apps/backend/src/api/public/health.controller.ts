import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { HealthCheckHandler, HealthCheckResult } from '../../modules/ops/health-check/health-check.handler';

@ApiTags('Public / Health')
@Controller('health')
export class PublicHealthController {
  constructor(private readonly healthCheck: HealthCheckHandler) {}

  @Get()
  @ApiOperation({ summary: 'Platform health check (DB, Redis, BullMQ)' })
  @ApiOkResponse({
    description: 'Health check result with per-service status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        db: { type: 'string', example: 'ok' },
        redis: { type: 'string', example: 'ok' },
        queue: { type: 'string', example: 'ok' },
      },
    },
  })
  check(): Promise<HealthCheckResult> {
    return this.healthCheck.execute();
  }
}
