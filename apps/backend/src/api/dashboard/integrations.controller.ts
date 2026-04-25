import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
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
  @ApiOperation({ summary: 'Get Zoom integration status (no secrets returned)' })
  @ApiOkResponse({ description: 'Configured + active flags' })
  getZoom() {
    return this.getZoomConfig.execute();
  }

  @Put('zoom')
  @ApiOperation({ summary: 'Create or update Zoom S2S OAuth credentials' })
  @ApiOkResponse({ description: 'Configured + active flags (no secrets returned)' })
  upsertZoom(@Body() body: UpsertZoomConfigDto) {
    return this.upsertZoomConfig.execute(body);
  }

  @Post('zoom/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate Zoom credentials by exchanging for an access token' })
  @ApiOkResponse({ description: '{ ok: boolean, error?: string }' })
  testZoom(@Body() body: UpsertZoomConfigDto) {
    return this.testZoomConfig.execute(body);
  }
}
