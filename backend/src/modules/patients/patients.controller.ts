import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { PatientsService } from './patients.service.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @CheckPermissions({ module: 'patients', action: 'view' })
  @ApiOperation({ summary: 'List all patients with pagination and search' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
  ) {
    return this.patientsService.findAll({
      page: page ? parseInt(page) : undefined,
      perPage: perPage ? parseInt(perPage) : undefined,
      search,
    });
  }

  @Get(':id')
  @CheckPermissions({ module: 'patients', action: 'view' })
  @ApiOperation({ summary: 'Get patient by ID with recent bookings' })
  findOne(@Param('id', uuidPipe) id: string) {
    return this.patientsService.findOne(id);
  }

  @Get(':id/stats')
  @CheckPermissions({ module: 'patients', action: 'view' })
  @ApiOperation({ summary: 'Get patient booking and payment statistics' })
  getStats(@Param('id', uuidPipe) id: string) {
    return this.patientsService.getPatientStats(id);
  }
}
