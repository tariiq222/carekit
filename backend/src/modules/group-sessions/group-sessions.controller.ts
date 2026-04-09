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
import { Public } from '../../common/decorators/public.decorator.js';
import { GroupSessionsService } from './group-sessions.service.js';
import { GroupSessionsSessionsService } from './group-sessions-sessions.service.js';
import { GroupSessionsEnrollmentsService } from './group-sessions-enrollments.service.js';
import { CreateOfferingDto } from './dto/create-offering.dto.js';
import { UpdateOfferingDto } from './dto/update-offering.dto.js';
import { OfferingListQueryDto } from './dto/offering-list-query.dto.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SessionListQueryDto } from './dto/session-list-query.dto.js';
import { EnrollPatientDto } from './dto/enroll-patient.dto.js';
import { MarkAttendanceDto } from './dto/mark-attendance.dto.js';

@ApiTags('Group Sessions')
@ApiBearerAuth()
@Controller('group-sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('group_sessions')
export class GroupSessionsController {
  constructor(
    private readonly offeringsService: GroupSessionsService,
    private readonly sessionsService: GroupSessionsSessionsService,
    private readonly enrollmentsService: GroupSessionsEnrollmentsService,
  ) {}

  // ─── Offerings ───

  @Get('offerings')
  @Public()
  @ApiOperation({ summary: 'List group offerings' })
  findAllOfferings(@Query() query: OfferingListQueryDto) {
    return this.offeringsService.findAllOfferings(query);
  }

  @Get('offerings/:id')
  @Public()
  @ApiOperation({ summary: 'Get group offering by ID' })
  findOneOffering(@Param('id', ParseUUIDPipe) id: string) {
    return this.offeringsService.findOneOffering(id);
  }

  @Post('offerings')
  @ApiOperation({ summary: 'Create group offering' })
  @CheckPermissions({ module: 'group_sessions', action: 'create' })
  createOffering(@Body() dto: CreateOfferingDto) {
    return this.offeringsService.createOffering(dto);
  }

  @Patch('offerings/:id')
  @ApiOperation({ summary: 'Update group offering' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  updateOffering(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferingDto,
  ) {
    return this.offeringsService.updateOffering(id, dto);
  }

  @Delete('offerings/:id')
  @ApiOperation({ summary: 'Soft delete group offering' })
  @CheckPermissions({ module: 'group_sessions', action: 'delete' })
  removeOffering(@Param('id', ParseUUIDPipe) id: string) {
    return this.offeringsService.removeOffering(id);
  }

  // ─── Sessions ───

  @Post('offerings/:id/sessions')
  @ApiOperation({ summary: 'Schedule a session for an offering' })
  @CheckPermissions({ module: 'group_sessions', action: 'create' })
  createSession(
    @Param('id', ParseUUIDPipe) offeringId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sessionsService.createSession(offeringId, dto);
  }

  @Get('sessions')
  @Public()
  @ApiOperation({ summary: 'List all group sessions' })
  findAllSessions(@Query() query: SessionListQueryDto) {
    return this.sessionsService.findAllSessions(query);
  }

  @Get('sessions/:id')
  @Public()
  @ApiOperation({ summary: 'Get session detail with enrollments' })
  findOneSession(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.findOneSession(id);
  }

  @Patch('sessions/:id/cancel')
  @ApiOperation({ summary: 'Cancel a group session (admin)' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  cancelSession(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.cancelSession(id);
  }

  @Post('sessions/:id/attendance')
  @ApiOperation({ summary: 'Mark attendance and complete session' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  completeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.sessionsService.completeSession(id, dto.attendedPatientIds);
  }

  // ─── Enrollments ───

  @Post('sessions/:id/enroll')
  @ApiOperation({ summary: 'Enroll a patient in a session' })
  enrollPatient(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: EnrollPatientDto,
  ) {
    return this.enrollmentsService.enroll(sessionId, dto.patientId);
  }

  @Patch('sessions/:sessionId/enrollments/:enrollmentId/cancel')
  @ApiOperation({ summary: 'Patient cancels own enrollment (pre-payment only)' })
  cancelEnrollment(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: EnrollPatientDto,
  ) {
    return this.enrollmentsService.cancelEnrollment(enrollmentId, dto.patientId);
  }

  @Delete('sessions/:sessionId/enrollments/:enrollmentId')
  @ApiOperation({ summary: 'Admin removes enrollment (pre-payment only)' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  removeEnrollment(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ) {
    return this.enrollmentsService.removeEnrollment(enrollmentId);
  }
}
