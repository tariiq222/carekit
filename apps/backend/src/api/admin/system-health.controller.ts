import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { AdminHostGuard } from '../../common/guards/admin-host.guard';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { SuperAdminContextInterceptor } from '../../common/interceptors/super-admin-context.interceptor';
import { GetSystemHealthHandler } from '../../modules/platform/system-health/get-system-health/get-system-health.handler';

@ApiTags('Admin / System Health')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('admin/system-health')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class SystemHealthController {
  constructor(private readonly getHealth: GetSystemHealthHandler) {}

  @Get()
  @ApiOperation({ summary: 'Check platform system health' })
  @ApiOkResponse({ schema: { type: 'object', description: 'System health check result' } })
  check() {
    return this.getHealth.execute();
  }
}
