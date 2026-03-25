import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { ClinicHoursService } from './clinic-hours.service.js';
import { SetWorkingHoursDto } from './dto/set-working-hours.dto.js';

@ApiTags('Clinic')
@ApiBearerAuth()
@Controller('clinic/hours')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClinicHoursController {
  constructor(private readonly service: ClinicHoursService) {}

  @Get()
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  async getAll() {
    const data = await this.service.getAll();
    return { success: true, data };
  }

  @Put()
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  async setHours(@Body() dto: SetWorkingHoursDto) {
    const data = await this.service.setHours(dto);
    return { success: true, data };
  }
}
