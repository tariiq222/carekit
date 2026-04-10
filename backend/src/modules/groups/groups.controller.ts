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
import { GroupsService } from './groups.service.js';
import { GroupsEnrollmentsService } from './groups-enrollments.service.js';
import { GroupsAttendanceService } from './groups-attendance.service.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';
import { GroupQueryDto } from './dto/query-group.dto.js';
import { EnrollGroupDto } from './dto/enroll-group.dto.js';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto.js';
import { ConfirmAttendanceDto } from './dto/confirm-attendance.dto.js';
import { ConfirmScheduleDto } from './dto/confirm-schedule.dto.js';

@ApiTags('Groups')
@ApiBearerAuth()
@Controller('groups')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly enrollmentsService: GroupsEnrollmentsService,
    private readonly attendanceService: GroupsAttendanceService,
  ) {}

  // ─── Groups ───

  @Post()
  @ApiOperation({ summary: 'Create group' })
  @CheckPermissions({ module: 'groups', action: 'create' })
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List groups' })
  @CheckPermissions({ module: 'groups', action: 'view' })
  findAll(@Query() query: GroupQueryDto) {
    return this.groupsService.findAll(query);
  }

  @Get('practitioner/:practitionerId')
  @ApiOperation({ summary: 'Get groups by practitioner' })
  @CheckPermissions({ module: 'groups', action: 'view' })
  getByPractitioner(@Param('practitionerId', ParseUUIDPipe) practitionerId: string) {
    return this.groupsService.getGroupsByPractitioner(practitionerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group detail' })
  @CheckPermissions({ module: 'groups', action: 'view' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update group' })
  @CheckPermissions({ module: 'groups', action: 'edit' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete group' })
  @CheckPermissions({ module: 'groups', action: 'delete' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.remove(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel group' })
  @CheckPermissions({ module: 'groups', action: 'edit' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.cancel(id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete group + mark attendance' })
  @CheckPermissions({ module: 'groups', action: 'edit' })
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BulkAttendanceDto) {
    return this.groupsService.complete(id, dto.attendedPatientIds);
  }

  @Patch(':id/trigger-payment')
  @ApiOperation({ summary: 'Trigger payment request for all registered enrollments (on_capacity flow)' })
  @CheckPermissions({ module: 'groups', action: 'edit' })
  triggerPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.triggerPaymentRequest(id);
  }

  @Patch(':id/enrollments/:enrollmentId/resend-payment')
  @ApiOperation({ summary: 'Resend payment request to a single unpaid enrollment' })
  @CheckPermissions({ module: 'groups', action: 'edit' })
  resendPayment(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ) {
    return this.groupsService.resendPaymentRequest(groupId, enrollmentId);
  }

  @Patch(':id/confirm-schedule')
  @ApiOperation({ summary: 'Set group date after payments collected (on_capacity flow)' })
  @CheckPermissions({ module: 'groups', action: 'edit' })
  confirmSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmScheduleDto,
  ) {
    return this.groupsService.confirmSchedule(id, dto);
  }

  // ─── Enrollments ───

  @Post(':id/enroll')
  @ApiOperation({ summary: 'Enroll a patient' })
  @CheckPermissions({ module: 'groups', action: 'edit' })
  enroll(@Param('id', ParseUUIDPipe) groupId: string, @Body() dto: EnrollGroupDto) {
    return this.enrollmentsService.enroll(groupId, dto.patientId);
  }

  @Delete(':groupId/enrollments/:enrollmentId')
  @ApiOperation({ summary: 'Remove enrollment (admin)' })
  @CheckPermissions({ module: 'groups', action: 'edit' })
  removeEnrollment(@Param('enrollmentId', ParseUUIDPipe) enrollmentId: string) {
    return this.enrollmentsService.removeEnrollment(enrollmentId);
  }

  // ─── Attendance ───

  @Patch(':id/attendance')
  @ApiOperation({ summary: 'Confirm attendance for a single enrollment' })
  @CheckPermissions({ module: 'groups', action: 'edit' })
  confirmAttendance(@Body() dto: ConfirmAttendanceDto) {
    return this.attendanceService.confirmAttendance(dto);
  }

  @Patch(':id/bulk-attendance')
  @ApiOperation({ summary: 'Bulk confirm attendance for multiple patients' })
  @CheckPermissions({ module: 'groups', action: 'edit' })
  bulkConfirmAttendance(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: BulkAttendanceDto,
  ) {
    return this.attendanceService.bulkConfirmAttendance(groupId, dto.attendedPatientIds);
  }

  @Post(':id/enrollments/:enrollmentId/certificate')
  @ApiOperation({ summary: 'Issue completion certificate for an attended enrollment' })
  @CheckPermissions({ module: 'groups', action: 'edit' })
  issueCertificate(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ) {
    return this.attendanceService.issueCertificate(enrollmentId);
  }
}
