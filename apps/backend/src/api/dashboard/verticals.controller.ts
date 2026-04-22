import { Body, Controller, Delete, Param, Patch, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { CreateVerticalDto } from '../../modules/platform/verticals/dto/create-vertical.dto';
import { UpdateVerticalDto } from '../../modules/platform/verticals/dto/update-vertical.dto';
import { UpsertTerminologyOverrideDto } from '../../modules/platform/verticals/dto/upsert-terminology-override.dto';
import { UpsertSeedDepartmentDto } from '../../modules/platform/verticals/dto/upsert-seed-department.dto';
import { UpsertSeedServiceCategoryDto } from '../../modules/platform/verticals/dto/upsert-seed-service-category.dto';
import { CreateVerticalHandler } from '../../modules/platform/verticals/create-vertical.handler';
import { UpdateVerticalHandler } from '../../modules/platform/verticals/update-vertical.handler';
import { DeleteVerticalHandler } from '../../modules/platform/verticals/delete-vertical.handler';
import { UpsertTerminologyOverrideHandler } from '../../modules/platform/verticals/upsert-terminology-override.handler';
import { UpsertSeedDepartmentHandler } from '../../modules/platform/verticals/upsert-seed-department.handler';
import { UpsertSeedServiceCategoryHandler } from '../../modules/platform/verticals/upsert-seed-service-category.handler';

@ApiTags('Dashboard / Platform')
@ApiBearerAuth()
@UseGuards(JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
@Controller('dashboard/verticals')
export class DashboardVerticalsController {
  constructor(
    private readonly createHandler: CreateVerticalHandler,
    private readonly updateHandler: UpdateVerticalHandler,
    private readonly deleteHandler: DeleteVerticalHandler,
    private readonly upsertTerm: UpsertTerminologyOverrideHandler,
    private readonly upsertDept: UpsertSeedDepartmentHandler,
    private readonly upsertCat: UpsertSeedServiceCategoryHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a vertical (super-admin)' })
  @ApiStandardResponses()
  create(@Body() dto: CreateVerticalDto) {
    return this.createHandler.execute(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vertical' })
  @ApiParam({ name: 'id' })
  @ApiStandardResponses()
  update(@Param('id') id: string, @Body() dto: UpdateVerticalDto) {
    return this.updateHandler.execute({ id, ...dto });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a vertical' })
  @ApiParam({ name: 'id' })
  @ApiStandardResponses()
  delete(@Param('id') id: string) {
    return this.deleteHandler.execute({ id });
  }

  @Put(':id/terminology/:tokenKey')
  @ApiOperation({ summary: 'Upsert a terminology override for a vertical' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'tokenKey' })
  @ApiStandardResponses()
  upsertOverride(
    @Param('id') verticalId: string,
    @Param('tokenKey') tokenKey: string,
    @Body() dto: UpsertTerminologyOverrideDto,
  ) {
    return this.upsertTerm.execute({ verticalId, tokenKey, valueAr: dto.valueAr, valueEn: dto.valueEn });
  }

  @Put(':id/seed-departments')
  @ApiOperation({ summary: 'Upsert a seed department for a vertical' })
  @ApiParam({ name: 'id' })
  @ApiStandardResponses()
  upsertSeedDepartment(
    @Param('id') verticalId: string,
    @Body() dto: UpsertSeedDepartmentDto,
  ) {
    return this.upsertDept.execute({ verticalId, ...dto });
  }

  @Put(':id/seed-service-categories')
  @ApiOperation({ summary: 'Upsert a seed service category for a vertical' })
  @ApiParam({ name: 'id' })
  @ApiStandardResponses()
  upsertSeedServiceCategory(
    @Param('id') verticalId: string,
    @Body() dto: UpsertSeedServiceCategoryDto,
  ) {
    return this.upsertCat.execute({ verticalId, ...dto });
  }
}
