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
import { ClinicHoursService } from './clinic-hours.service.js';
import { SetWorkingHoursDto } from './dto/set-working-hours.dto.js';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';

@ApiTags('Clinic')
@ApiBearerAuth()
@Controller('clinic/hours')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClinicHoursController {
  constructor(private readonly service: ClinicHoursService) {}

  @Get()
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  @ApiOperation({ summary: 'Get clinic working hours for all days' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  async getAll() {
    const data = await this.service.getAll();
    return { success: true, data };
  }

  @Put()
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  @ApiOperation({ summary: 'Set clinic working hours (replaces all)' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  async setHours(@Body() dto: SetWorkingHoursDto) {
    const data = await this.service.setHours(dto);
    return { success: true, data };
  }
}
