import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { WhitelabelService } from './whitelabel.service.js';
import { UpdateWhitelabelDto } from './dto/update-config.dto.js';

@ApiTags('Whitelabel')
@ApiBearerAuth()
@Controller('whitelabel')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WhitelabelController {
  constructor(private readonly whitelabelService: WhitelabelService) {}

  @Get('public')
  @Public()
  getPublicBranding() {
    return this.whitelabelService.getPublicBranding();
  }

  @Get()
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  get() {
    return this.whitelabelService.get();
  }

  @Put()
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  update(@Body() dto: UpdateWhitelabelDto) {
    return this.whitelabelService.update(dto);
  }
}
