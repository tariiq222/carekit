import { Controller, Get, Post, Put, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GetZoomConfigHandler } from './get-zoom-config.handler';
import { UpsertZoomConfigHandler } from './upsert-zoom-config.handler';
import { TestZoomConfigHandler } from './test-zoom-config.handler';
import { UpsertZoomConfigDto } from './dto/upsert-zoom-config.dto';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard } from '../../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../../common/swagger';

@ApiTags('Integrations')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('integrations/zoom')
@UseGuards(JwtGuard, CaslGuard)
export class ZoomConfigController {
  constructor(
    private readonly getHandler: GetZoomConfigHandler,
    private readonly upsertHandler: UpsertZoomConfigHandler,
    private readonly testHandler: TestZoomConfigHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get Zoom integration status' })
  async getConfig() {
    return this.getHandler.execute();
  }

  @Put()
  @ApiOperation({ summary: 'Upsert Zoom integration config' })
  async upsertConfig(@Body() dto: UpsertZoomConfigDto) {
    return this.upsertHandler.execute(dto);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test Zoom integration config' })
  async testConfig(@Body() dto: UpsertZoomConfigDto) {
    return this.testHandler.execute(dto);
  }
}
