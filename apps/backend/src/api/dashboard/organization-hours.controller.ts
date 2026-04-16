import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { SetBusinessHoursHandler } from '../../modules/org-config/business-hours/set-business-hours.handler';
import { SetBusinessHoursDto } from '../../modules/org-config/business-hours/set-business-hours.dto';
import { GetBusinessHoursHandler } from '../../modules/org-config/business-hours/get-business-hours.handler';
import { AddHolidayHandler } from '../../modules/org-config/business-hours/add-holiday.handler';
import { AddHolidayDto } from '../../modules/org-config/business-hours/add-holiday.dto';
import { RemoveHolidayHandler } from '../../modules/org-config/business-hours/remove-holiday.handler';
import { ListHolidaysHandler } from '../../modules/org-config/business-hours/list-holidays.handler';
import { ListHolidaysDto } from '../../modules/org-config/business-hours/list-holidays.dto';

@ApiTags('Business Hours')
@ApiBearerAuth()
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
  setBusinessHoursEndpoint(@Body() body: SetBusinessHoursDto) {
    return this.setBusinessHours.execute(body);
  }

  @Get('hours/:branchId')
  getBusinessHoursEndpoint(@Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.getBusinessHours.execute({ branchId });
  }

  @Post('holidays')
  addHolidayEndpoint(@Body() body: AddHolidayDto) {
    return this.addHoliday.execute(body);
  }

  @Delete('holidays/:holidayId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeHolidayEndpoint(@Param('holidayId', ParseUUIDPipe) holidayId: string) {
    return this.removeHoliday.execute({ holidayId });
  }

  @Get('holidays')
  listHolidaysEndpoint(@Query() query: ListHolidaysDto) {
    return this.listHolidays.execute(query);
  }
}
