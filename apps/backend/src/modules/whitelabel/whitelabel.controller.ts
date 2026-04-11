import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { WhitelabelService } from './whitelabel.service.js';
import { UpdateWhitelabelDto } from './dto/update-config.dto.js';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';

@ApiTags('Whitelabel')
@ApiBearerAuth()
@Controller('whitelabel')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WhitelabelController {
  constructor(private readonly whitelabelService: WhitelabelService) {}

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Get public branding configuration' })
  @ApiResponse({ status: 200, description: 'Branding config returned' })
  getPublicBranding() {
    return this.whitelabelService.getPublicBranding();
  }

  @Get()
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  @ApiOperation({ summary: 'Get whitelabel configuration' })
  @ApiResponse({ status: 200, description: 'Branding config returned' })
  @ApiStandardResponses()
  get() {
    return this.whitelabelService.get();
  }

  @Put()
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  @ApiOperation({ summary: 'Update whitelabel configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  @ApiStandardResponses()
  update(@Body() dto: UpdateWhitelabelDto) {
    return this.whitelabelService.update(dto);
  }
}
