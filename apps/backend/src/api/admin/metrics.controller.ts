import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminHostGuard, JwtGuard, SuperAdminGuard } from '../../common/guards';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { ApiStandardResponses } from '../../common/swagger';
import { GetPlatformMetricsHandler } from '../../modules/platform/admin/get-platform-metrics/get-platform-metrics.handler';
import { PlatformMetricsDto } from './dto/admin-response.dto';

@ApiTags('Admin / Metrics')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('admin/metrics')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminMetricsController {
  constructor(private readonly handler: GetPlatformMetricsHandler) {}

  @Get('platform')
  @ApiOperation({ summary: 'Get platform-wide metrics across all tenants' })
  @ApiOkResponse({ type: PlatformMetricsDto })
  platform() {
    return this.handler.execute();
  }
}
