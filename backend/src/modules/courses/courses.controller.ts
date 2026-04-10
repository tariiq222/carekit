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
import { CoursesService } from './courses.service.js';
import { CoursesEnrollmentsService } from './courses-enrollments.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { CourseQueryDto } from './dto/course-query.dto.js';
import { EnrollCourseDto } from './dto/enroll-course.dto.js';
import { MarkCourseAttendanceDto } from './dto/mark-course-attendance.dto.js';

@ApiTags('Courses')
@ApiBearerAuth()
@Controller('courses')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly enrollmentsService: CoursesEnrollmentsService,
  ) {}

  // ─── Courses CRUD ───

  @Post()
  @ApiOperation({ summary: 'Create a new training course' })
  @CheckPermissions({ module: 'courses', action: 'create' })
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List training courses' })
  @CheckPermissions({ module: 'courses', action: 'view' })
  findAll(@Query() query: CourseQueryDto) {
    return this.coursesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course detail with sessions and enrollments' })
  @CheckPermissions({ module: 'courses', action: 'view' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update course info' })
  @CheckPermissions({ module: 'courses', action: 'edit' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete draft course (soft delete)' })
  @CheckPermissions({ module: 'courses', action: 'delete' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.remove(id);
  }

  // ─── Status Transitions ───

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish course (draft → published)' })
  @CheckPermissions({ module: 'courses', action: 'edit' })
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.publish(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel course and drop all active enrollments' })
  @CheckPermissions({ module: 'courses', action: 'edit' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.cancel(id);
  }

  // ─── Attendance ───

  @Patch(':id/attendance')
  @ApiOperation({ summary: 'Mark attendance for a course session' })
  @CheckPermissions({ module: 'courses', action: 'edit' })
  markAttendance(
    @Param('id', ParseUUIDPipe) courseId: string,
    @Body() dto: MarkCourseAttendanceDto,
  ) {
    return this.coursesService.markAttendance(courseId, dto);
  }

  // ─── Enrollments ───

  @Post(':id/enroll')
  @ApiOperation({ summary: 'Enroll a patient in a course' })
  @CheckPermissions({ module: 'courses', action: 'edit' })
  enroll(
    @Param('id', ParseUUIDPipe) courseId: string,
    @Body() dto: EnrollCourseDto,
  ) {
    return this.enrollmentsService.enroll(courseId, dto.patientId);
  }

  @Delete(':courseId/enrollments/:enrollmentId/drop')
  @ApiOperation({ summary: 'Drop a patient enrollment' })
  @CheckPermissions({ module: 'courses', action: 'edit' })
  dropEnrollment(@Param('enrollmentId', ParseUUIDPipe) enrollmentId: string) {
    return this.enrollmentsService.dropEnrollment(enrollmentId);
  }

  @Patch(':courseId/enrollments/:enrollmentId/refund')
  @ApiOperation({ summary: 'Mark enrollment as refunded (admin only)' })
  @CheckPermissions({ module: 'courses', action: 'edit' })
  refundEnrollment(@Param('enrollmentId', ParseUUIDPipe) enrollmentId: string) {
    return this.enrollmentsService.refundEnrollment(enrollmentId);
  }
}
