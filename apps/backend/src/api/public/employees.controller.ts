import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { ListPublicEmployeesHandler } from '../../modules/people/employees/public/list-public-employees.handler';
import { GetPublicEmployeeHandler } from '../../modules/people/employees/public/get-public-employee.handler';

@ApiTags('Public / Employees')
@ApiPublicResponses()
@Controller('public/employees')
export class PublicEmployeesController {
  constructor(
    private readonly listHandler: ListPublicEmployeesHandler,
    private readonly getHandler: GetPublicEmployeeHandler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  @ApiOperation({ summary: 'List public-facing employees' })
  @ApiOkResponse({ description: 'Public employees with slug + bio + image' })
  list() {
    return this.listHandler.execute();
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get(':key')
  @ApiOperation({ summary: 'Get single public employee by slug or id' })
  @ApiParam({ name: 'key', description: 'Public slug or employee UUID', example: 'dr-ahmed' })
  @ApiOkResponse({ description: 'Single public employee' })
  getOne(@Param('key') key: string) {
    return this.getHandler.execute(key);
  }
}
