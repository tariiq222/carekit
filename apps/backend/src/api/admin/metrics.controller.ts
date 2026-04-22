import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminHostGuard, JwtGuard, SuperAdminGuard } from '../../common/guards';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { GetPlatformMetricsHandler } from '../../modules/platform/admin/get-platform-metrics/get-platform-metrics.handler';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('api/v1/admin/metrics')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminMetricsController {
  constructor(private readonly handler: GetPlatformMetricsHandler) {}

  @Get('platform')
  @ApiOperation({ summary: 'Platform-wide metrics across all tenants' })
  platform() {
    return this.handler.execute();
  }
}
