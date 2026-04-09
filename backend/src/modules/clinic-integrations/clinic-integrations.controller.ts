import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { ClinicIntegrationsService } from './clinic-integrations.service.js';
import { UpdateClinicIntegrationsDto } from './dto/update-clinic-integrations.dto.js';

@ApiTags('Clinic Integrations')
@ApiBearerAuth()
@Controller('clinic-integrations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClinicIntegrationsController {
  constructor(private readonly service: ClinicIntegrationsService) {}

  @Get()
  @CheckPermissions({ module: 'clinic-integrations', action: 'view' })
  get() {
    return this.service.getMasked();
  }

  @Put()
  @CheckPermissions({ module: 'clinic-integrations', action: 'edit' })
  update(@Body() dto: UpdateClinicIntegrationsDto) {
    return this.service.update(dto);
  }
}
