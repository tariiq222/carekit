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
import { ClinicSettingsService } from './clinic-settings.service.js';
import { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto.js';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';

@ApiTags('Clinic Settings')
@ApiBearerAuth()
@Controller('clinic-settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClinicSettingsController {
  constructor(private readonly clinicSettingsService: ClinicSettingsService) {}

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Get public clinic information' })
  @ApiResponse({ status: 200 })
  getPublic() {
    return this.clinicSettingsService.getPublic();
  }

  @Get()
  @CheckPermissions({ module: 'clinic-settings', action: 'view' })
  @ApiOperation({ summary: 'Get clinic settings' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  get() {
    return this.clinicSettingsService.get();
  }

  @Put()
  @CheckPermissions({ module: 'clinic-settings', action: 'edit' })
  @ApiOperation({ summary: 'Update clinic settings' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  update(@Body() dto: UpdateClinicSettingsDto) {
    return this.clinicSettingsService.update(dto);
  }
}
