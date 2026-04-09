import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { LicenseService } from './license.service.js';
import { UpdateLicenseDto } from './dto/update-license.dto.js';

@ApiTags('License')
@ApiBearerAuth()
@Controller('license')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get()
  @CheckPermissions({ module: 'license', action: 'view' })
  get() {
    return this.licenseService.get();
  }

  @Put()
  @CheckPermissions({ module: 'license', action: 'edit' })
  update(@Body() dto: UpdateLicenseDto) {
    return this.licenseService.update(dto);
  }

  @Get('features')
  @CheckPermissions({ module: 'license', action: 'view' })
  getFeatures() {
    return this.licenseService.getFeaturesWithStatus();
  }
}
