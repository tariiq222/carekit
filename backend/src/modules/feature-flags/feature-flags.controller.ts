import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { FeatureFlagsService } from './feature-flags.service.js';
import { ToggleFeatureFlagDto } from './dto/toggle-feature-flag.dto.js';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@Controller('feature-flags')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FeatureFlagsController {
  constructor(private readonly service: FeatureFlagsService) {}

  @Get()
  @CheckPermissions({ module: 'feature-flags', action: 'view' })
  @ApiOperation({ summary: 'List all feature flags with their current status' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  findAll() {
    return this.service.findAll();
  }

  @Get('map')
  @Public()
  @ApiOperation({
    summary: 'Get feature flag map as key-value pairs (cached, public)',
  })
  @ApiResponse({ status: 200 })
  getMap() {
    return this.service.getMap();
  }

  @Patch(':key')
  @CheckPermissions({ module: 'feature-flags', action: 'edit' })
  @ApiOperation({ summary: 'Enable or disable a feature flag' })
  @ApiParam({
    name: 'key',
    description: 'Feature flag key (e.g. multi_branch)',
  })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  toggle(@Param('key') key: string, @Body() dto: ToggleFeatureFlagDto) {
    return this.service.toggle(key, dto.enabled);
  }
}
