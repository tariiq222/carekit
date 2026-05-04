import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { RequireFeature } from '../../modules/platform/billing/feature.decorator';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { GetZoomConfigHandler } from '../../modules/integrations/zoom/get-zoom-config.handler';
import { UpsertZoomConfigHandler } from '../../modules/integrations/zoom/upsert-zoom-config.handler';
import { TestZoomConfigHandler } from '../../modules/integrations/zoom/test-zoom-config.handler';
import { UpsertZoomConfigDto } from '../../modules/integrations/zoom/dto/upsert-zoom-config.dto';

@ApiTags('Dashboard / Integrations')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/integrations')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardIntegrationsController {
  constructor(
    private readonly getZoomConfig: GetZoomConfigHandler,
    private readonly upsertZoomConfig: UpsertZoomConfigHandler,
    private readonly testZoomConfig: TestZoomConfigHandler,
  ) {}

  @Get('zoom')
  @RequireFeature(FeatureKey.ZOOM_INTEGRATION)
  @ApiOperation({ summary: 'Get Zoom integration status (no secrets returned)' })
  @ApiOkResponse({
    description: 'Configured + active flags',
    schema: {
      type: 'object',
      properties: {
        isConfigured: { type: 'boolean' },
        isActive: { type: 'boolean' },
      },
    },
  })
  getZoom() {
    return this.getZoomConfig.execute();
  }

  @Put('zoom')
  @RequireFeature(FeatureKey.ZOOM_INTEGRATION)
  @ApiOperation({ summary: 'Create or update Zoom S2S OAuth credentials' })
  @ApiOkResponse({
    description: 'Configured + active flags (no secrets returned)',
    schema: {
      type: 'object',
      properties: {
        isConfigured: { type: 'boolean' },
        isActive: { type: 'boolean' },
      },
    },
  })
  upsertZoom(@Body() body: UpsertZoomConfigDto) {
    return this.upsertZoomConfig.execute(body);
  }

  @Post('zoom/test')
  @RequireFeature(FeatureKey.ZOOM_INTEGRATION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate Zoom credentials by exchanging for an access token' })
  @ApiOkResponse({
    description: 'Zoom credential test result',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        error: { type: 'string', nullable: true },
      },
    },
  })
  testZoom(@Body() body: UpsertZoomConfigDto) {
    return this.testZoomConfig.execute(body);
  }
}
