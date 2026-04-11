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
import { LicenseService } from './license.service.js';
import { UpdateLicenseDto } from './dto/update-license.dto.js';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';

@ApiTags('License')
@ApiBearerAuth()
@Controller('license')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get()
  @CheckPermissions({ module: 'license', action: 'view' })
  @ApiOperation({ summary: 'Get current license configuration' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  get() {
    return this.licenseService.get();
  }

  @Put()
  @CheckPermissions({ module: 'license', action: 'edit' })
  @ApiOperation({ summary: 'Update license feature entitlements' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  update(@Body() dto: UpdateLicenseDto) {
    return this.licenseService.update(dto);
  }

  @Get('features')
  @CheckPermissions({ module: 'license', action: 'view' })
  @ApiOperation({
    summary: 'Get enabled features derived from current license',
  })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  getFeatures() {
    return this.licenseService.getFeaturesWithStatus();
  }
}
