import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiOkResponse,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/swagger';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ListBookingsHandler } from '../../../modules/bookings/list-bookings/list-bookings.handler';
import {
  UpdateAvailabilityHandler,
  AvailabilityWindow,
  AvailabilityException,
} from '../../../modules/people/employees/update-availability.handler';
import { IsArray, ValidateNested } from 'class-validator';

export class EmployeeScheduleQuery {
  @ApiPropertyOptional({ description: 'Start of date range (ISO 8601)', example: '2026-04-01' })
  @IsOptional() @IsDateString() fromDate?: string;

  @ApiPropertyOptional({ description: 'End of date range (ISO 8601)', example: '2026-04-07' })
  @IsOptional() @IsDateString() toDate?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Results per page', example: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

export class UpdateAvailabilityBody {
  @IsArray() @ValidateNested({ each: true }) windows!: AvailabilityWindow[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) exceptions?: AvailabilityException[];
}

@ApiTags('Mobile Employee / Schedule')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard)
@Controller('mobile/employee/schedule')
export class MobileEmployeeScheduleController {
  constructor(
    private readonly listBookings: ListBookingsHandler,
    private readonly updateAvailability: UpdateAvailabilityHandler,
  ) {}

  @ApiOperation({ summary: 'Get today\'s bookings for the authenticated employee' })
  @ApiOkResponse({ description: 'Paginated list of today\'s bookings', schema: { type: 'object' } })
  @Get('today')
  today(@CurrentUser() user: JwtUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    return this.listBookings.execute({
      employeeId: user.sub,
      fromDate: today,
      toDate: tomorrow,
      page: 1,
      limit: 50,
    });
  }

  @ApiOperation({ summary: 'Get weekly bookings for the authenticated employee' })
  @ApiOkResponse({ description: 'Paginated list of bookings within the given date range', schema: { type: 'object' } })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Start of date range (ISO 8601)', example: '2026-04-01' })
  @ApiQuery({ name: 'toDate', required: false, description: 'End of date range (ISO 8601)', example: '2026-04-07' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 100 })
  @Get('weekly')
  weekly(
    @CurrentUser() user: JwtUser,
    @Query() q: EmployeeScheduleQuery,
  ) {
    return this.listBookings.execute({
      employeeId: user.sub,
      fromDate: q.fromDate ? new Date(q.fromDate) : undefined,
      toDate: q.toDate ? new Date(q.toDate) : undefined,
      page: q.page ?? 1,
      limit: q.limit ?? 100,
    });
  }

  @ApiOperation({ summary: 'Update availability windows and exceptions for the authenticated employee' })
  @ApiOkResponse({ description: 'Availability updated successfully', schema: { type: 'object' } })
  @Patch('availability')
  updateAvailabilityEndpoint(
    @CurrentUser() user: JwtUser,
    @Body() body: UpdateAvailabilityBody,
  ) {
    return this.updateAvailability.execute({
      employeeId: user.sub,
      windows: body.windows,
      exceptions: body.exceptions,
    });
  }
}
