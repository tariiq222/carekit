import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { RequireFeature } from '../../common/decorators/require-feature.decorator.js';
import { GroupSessionsService } from './group-sessions.service.js';
import { GroupSessionsEnrollmentsService } from './group-sessions-enrollments.service.js';
import { CreateGroupSessionDto } from './dto/create-group-session.dto.js';
import { UpdateGroupSessionDto } from './dto/update-group-session.dto.js';
import { GroupSessionQueryDto } from './dto/group-session-query.dto.js';
import { EnrollPatientDto } from './dto/enroll-patient.dto.js';
import { MarkAttendanceDto } from './dto/mark-attendance.dto.js';

@ApiTags('Group Sessions')
@ApiBearerAuth()
@Controller('group-sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('group_sessions')
export class GroupSessionsController {
  constructor(
    private readonly sessionsService: GroupSessionsService,
    private readonly enrollmentsService: GroupSessionsEnrollmentsService,
  ) {}

  // ─── Sessions ───

  @Post()
  @ApiOperation({ summary: 'Create group session' })
  @CheckPermissions({ module: 'group_sessions', action: 'create' })
  create(@Body() dto: CreateGroupSessionDto) {
    return this.sessionsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List group sessions' })
  @CheckPermissions({ module: 'group_sessions', action: 'view' })
  findAll(@Query() query: GroupSessionQueryDto) {
    return this.sessionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group session detail' })
  @CheckPermissions({ module: 'group_sessions', action: 'view' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update group session' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGroupSessionDto) {
    return this.sessionsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete group session' })
  @CheckPermissions({ module: 'group_sessions', action: 'delete' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.remove(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel group session' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.cancel(id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete session + mark attendance' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkAttendanceDto) {
    return this.sessionsService.complete(id, dto.attendedPatientIds);
  }

  // ─── Enrollments ───

  @Post(':id/enroll')
  @ApiOperation({ summary: 'Enroll a patient' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  enroll(@Param('id', ParseUUIDPipe) sessionId: string, @Body() dto: EnrollPatientDto) {
    return this.enrollmentsService.enroll(sessionId, dto.patientId);
  }

  @Delete(':sessionId/enrollments/:enrollmentId')
  @ApiOperation({ summary: 'Remove enrollment (admin)' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  removeEnrollment(@Param('enrollmentId', ParseUUIDPipe) enrollmentId: string) {
    return this.enrollmentsService.removeEnrollment(enrollmentId);
  }
}
