import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { PatientsService } from './patients.service.js';
import { PatientWalkInService } from './patient-walk-in.service.js';
import { CreateWalkInPatientDto } from './dto/create-walk-in-patient.dto.js';
import { ClaimAccountDto } from './dto/claim-account.dto.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly walkInService: PatientWalkInService,
  ) {}

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

  @Patch(':id')
  @CheckPermissions({ module: 'patients', action: 'edit' })
  @ApiOperation({ summary: 'Update patient profile' })
  update(@Param('id', uuidPipe) id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.updatePatient(id, dto);
  }

  @Get(':id/stats')
  @CheckPermissions({ module: 'patients', action: 'view' })
  @ApiOperation({ summary: 'Get patient booking and payment statistics' })
  getStats(@Param('id', uuidPipe) id: string) {
    return this.patientsService.getPatientStats(id);
  }

  @Post('walk-in')
  @CheckPermissions({ module: 'patients', action: 'create' })
  @ApiOperation({
    summary: 'Register a walk-in patient (name + phone only, no email/password)',
    description: 'Used by receptionist to register a patient who visited the clinic without a prior account. Returns existing WALK_IN account if phone already registered.',
  })
  createWalkIn(@Body() dto: CreateWalkInPatientDto) {
    return this.walkInService.createWalkIn(dto);
  }

  @Post('claim')
  @CheckPermissions({ module: 'patients', action: 'create' })
  @ApiOperation({
    summary: 'Claim a walk-in account (activate with email + password)',
    description: 'Allows staff to upgrade a WALK_IN account to a full account by linking an email and password. The patient can then log in via the mobile app.',
  })
  claimAccount(@Body() dto: ClaimAccountDto) {
    return this.walkInService.claimAccount(dto);
  }
}
