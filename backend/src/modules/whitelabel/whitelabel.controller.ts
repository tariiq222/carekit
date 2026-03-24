import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { WhitelabelService } from './whitelabel.service.js';
import { UpdateConfigDto } from './dto/update-config.dto.js';

@ApiTags('Whitelabel')
@ApiBearerAuth()
@Controller('whitelabel')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WhitelabelController {
  constructor(private readonly whitelabelService: WhitelabelService) {}

  // ═══════════════════════════════════════════════════════════════
  //  GET /whitelabel/public — Public branding (no auth, for mobile pre-login)
  // ═══════════════════════════════════════════════════════════════

  @Get('public')
  @Public()
  async getPublicBranding() {
    return this.whitelabelService.getPublicBranding();
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /whitelabel/config — List all config entries
  // ═══════════════════════════════════════════════════════════════

  @Get('config')
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  async getConfig() {
    return this.whitelabelService.getConfig();
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /whitelabel/config/map — Return { key: value } object
  // ═══════════════════════════════════════════════════════════════

  @Get('config/map')
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  async getConfigMap() {
    return this.whitelabelService.getConfigMap();
  }

  // ═══════════════════════════════════════════════════════════════
  //  PUT /whitelabel/config — Upsert config entries
  // ═══════════════════════════════════════════════════════════════

  @Put('config')
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  async updateConfig(@Body() dto: UpdateConfigDto) {
    return this.whitelabelService.updateConfig(dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /whitelabel/config/:key — Get single config entry
  // ═══════════════════════════════════════════════════════════════

  @Get('config/:key')
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  async getConfigByKey(@Param('key') key: string) {
    return this.whitelabelService.getConfigByKey(key);
  }

  // ═══════════════════════════════════════════════════════════════
  //  DELETE /whitelabel/config/:key — Delete config entry
  // ═══════════════════════════════════════════════════════════════

  @Delete('config/:key')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  async deleteConfig(@Param('key') key: string) {
    return this.whitelabelService.deleteConfig(key);
  }
}
