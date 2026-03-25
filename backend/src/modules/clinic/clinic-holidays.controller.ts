import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { ClinicHolidaysService } from './clinic-holidays.service.js';
import { CreateHolidayDto } from './dto/create-holiday.dto.js';

@ApiTags('Clinic')
@ApiBearerAuth()
@Controller('clinic/holidays')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClinicHolidaysController {
  constructor(private readonly service: ClinicHolidaysService) {}

  @Get()
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  async findAll(@Query('year') year?: string) {
    const parsedYear = year ? parseInt(year, 10) : undefined;
    const data = await this.service.findAll(parsedYear);
    return { success: true, data };
  }

  @Post()
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  async create(@Body() dto: CreateHolidayDto) {
    const data = await this.service.create(dto);
    return { success: true, data };
  }

  @Delete(':id')
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  async remove(@Param('id') id: string) {
    await this.service.delete(id);
    return { success: true, data: null };
  }
}
