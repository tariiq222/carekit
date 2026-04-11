import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js'
import { Public } from '../../common/decorators/public.decorator.js'
import { ThemeService } from './theme.service.js'
import { UpdateThemeDto } from './dto/update-theme.dto.js'

@ApiTags('Theme')
@Controller('clinic-settings/theme')
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get clinic theme (public)' })
  getTheme() {
    return this.themeService.getTheme()
  }

  @Patch()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions({ module: 'clinic-settings', action: 'edit' })
  @ApiOperation({ summary: 'Update clinic theme (admin only)' })
  updateTheme(@Body() dto: UpdateThemeDto) {
    return this.themeService.updateTheme(dto)
  }

  @Delete()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions({ module: 'clinic-settings', action: 'edit' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset theme to CareKit defaults (admin only)' })
  resetTheme() {
    return this.themeService.resetTheme()
  }
}
