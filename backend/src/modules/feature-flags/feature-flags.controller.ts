import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { FeatureFlagsService } from './feature-flags.service.js';
import { ToggleFeatureFlagDto } from './dto/toggle-feature-flag.dto.js';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@Controller('feature-flags')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FeatureFlagsController {
  constructor(private readonly service: FeatureFlagsService) {}

  @Get()
  @CheckPermissions({ module: 'feature-flags', action: 'view' })
  findAll() {
    return this.service.findAll();
  }

  @Get('map')
  @Public()
  getMap() {
    return this.service.getMap();
  }

  @Patch(':key')
  @CheckPermissions({ module: 'feature-flags', action: 'edit' })
  toggle(@Param('key') key: string, @Body() dto: ToggleFeatureFlagDto) {
    return this.service.toggle(key, dto.enabled);
  }
}
