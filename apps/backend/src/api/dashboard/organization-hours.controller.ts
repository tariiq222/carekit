import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { SetBusinessHoursHandler } from '../../modules/org-config/business-hours/set-business-hours.handler';
import { SetBusinessHoursDto } from '../../modules/org-config/business-hours/set-business-hours.dto';
import { GetBusinessHoursHandler } from '../../modules/org-config/business-hours/get-business-hours.handler';
import { AddHolidayHandler } from '../../modules/org-config/business-hours/add-holiday.handler';
import { AddHolidayDto } from '../../modules/org-config/business-hours/add-holiday.dto';
import { RemoveHolidayHandler } from '../../modules/org-config/business-hours/remove-holiday.handler';
import { ListHolidaysHandler } from '../../modules/org-config/business-hours/list-holidays.handler';
import { ListHolidaysDto } from '../../modules/org-config/business-hours/list-holidays.dto';

@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationHoursController {
  constructor(
    private readonly setBusinessHours: SetBusinessHoursHandler,
    private readonly getBusinessHours: GetBusinessHoursHandler,
    private readonly addHoliday: AddHolidayHandler,
    private readonly removeHoliday: RemoveHolidayHandler,
    private readonly listHolidays: ListHolidaysHandler,
  ) {}

  @Post('hours')
  setBusinessHoursEndpoint(
    @TenantId() tenantId: string,
    @Body() body: SetBusinessHoursDto,
  ) {
    return this.setBusinessHours.execute({ tenantId, ...body });
  }

  @Get('hours/:branchId')
  getBusinessHoursEndpoint(
    @TenantId() tenantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.getBusinessHours.execute({ tenantId, branchId });
  }

  @Post('holidays')
  addHolidayEndpoint(
    @TenantId() tenantId: string,
    @Body() body: AddHolidayDto,
  ) {
    return this.addHoliday.execute({ tenantId, ...body });
  }

  @Delete('holidays/:holidayId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeHolidayEndpoint(
    @TenantId() tenantId: string,
    @Param('holidayId', ParseUUIDPipe) holidayId: string,
  ) {
    return this.removeHoliday.execute({ tenantId, holidayId });
  }

  @Get('holidays')
  listHolidaysEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListHolidaysDto,
  ) {
    return this.listHolidays.execute({ tenantId, ...query });
  }
}
