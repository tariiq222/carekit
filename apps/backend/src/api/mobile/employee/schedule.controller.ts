import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ListBookingsHandler } from '../../../modules/bookings/list-bookings/list-bookings.handler';
import {
  UpdateAvailabilityHandler,
  AvailabilityWindow,
  AvailabilityException,
} from '../../../modules/people/employees/update-availability.handler';
import { IsArray, ValidateNested } from 'class-validator';

export class EmployeeScheduleQuery {
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

export class UpdateAvailabilityBody {
  @IsArray() @ValidateNested({ each: true }) windows!: AvailabilityWindow[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) exceptions?: AvailabilityException[];
}

@UseGuards(JwtGuard)
@Controller('mobile/employee/schedule')
export class MobileEmployeeScheduleController {
  constructor(
    private readonly listBookings: ListBookingsHandler,
    private readonly updateAvailability: UpdateAvailabilityHandler,
  ) {}

  @Get('today')
  today(@TenantId() tenantId: string, @CurrentUser() user: JwtUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    return this.listBookings.execute({
      tenantId,
      employeeId: user.sub,
      fromDate: today,
      toDate: tomorrow,
      page: 1,
      limit: 50,
    });
  }

  @Get('weekly')
  weekly(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtUser,
    @Query() q: EmployeeScheduleQuery,
  ) {
    return this.listBookings.execute({
      tenantId,
      employeeId: user.sub,
      fromDate: q.fromDate ? new Date(q.fromDate) : undefined,
      toDate: q.toDate ? new Date(q.toDate) : undefined,
      page: q.page ?? 1,
      limit: q.limit ?? 100,
    });
  }

  @Patch('availability')
  updateAvailabilityEndpoint(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtUser,
    @Body() body: UpdateAvailabilityBody,
  ) {
    return this.updateAvailability.execute({
      tenantId,
      employeeId: user.sub,
      windows: body.windows,
      exceptions: body.exceptions,
    });
  }
}
