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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import { ProblemReportsService } from './problem-reports.service.js';
import { CreateProblemReportDto } from './dto/create-problem-report.dto.js';
import { ResolveProblemReportDto } from './dto/resolve-problem-report.dto.js';

@ApiTags('Problem Reports')
@ApiBearerAuth()
@Controller('problem-reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProblemReportsController {
  constructor(private readonly service: ProblemReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a problem report for a completed booking' })
  create(
    @Body() dto: CreateProblemReportDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.create({
      bookingId: dto.bookingId,
      patientId: user.id,
      type: dto.type,
      description: dto.description,
    });
  }

  @Get()
  @CheckPermissions({ module: 'reports', action: 'view' })
  @ApiOperation({ summary: 'List all problem reports (admin)' })
  findAll(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      status,
      patientId,
    });
  }

  @Get(':id')
  @CheckPermissions({ module: 'reports', action: 'view' })
  @ApiOperation({ summary: 'Get a single problem report' })
  findOne(@Param('id', uuidPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/resolve')
  @CheckPermissions({ module: 'reports', action: 'edit' })
  @ApiOperation({ summary: 'Resolve or dismiss a problem report (admin)' })
  resolve(
    @Param('id', uuidPipe) id: string,
    @Body() dto: ResolveProblemReportDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.resolve(id, user.id, {
      status: dto.status,
      adminNotes: dto.adminNotes,
    });
  }
}
