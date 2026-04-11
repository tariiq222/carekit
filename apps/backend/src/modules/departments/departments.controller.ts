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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { RequireFeature } from '../../common/decorators/require-feature.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { DepartmentsService } from './departments.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { ReorderDepartmentsDto } from './dto/reorder-departments.dto.js';
import { DepartmentListQueryDto } from './dto/department-list-query.dto.js';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List departments' })
  @ApiResponse({ status: 200, description: 'Departments list' })
  findAll(@Query() query: DepartmentListQueryDto) {
    return this.departmentsService.findAll(query);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder departments' })
  @ApiResponse({ status: 200, description: 'Departments reordered' })
  @ApiStandardResponses()
  @CheckPermissions({ module: 'departments', action: 'edit' })
  reorder(@Body() dto: ReorderDepartmentsDto) {
    return this.departmentsService.reorder(dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get department by ID' })
  @ApiResponse({ status: 200, description: 'Department details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create department' })
  @ApiResponse({ status: 201, description: 'Department created' })
  @ApiStandardResponses()
  @CheckPermissions({ module: 'departments', action: 'create' })
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update department' })
  @ApiResponse({ status: 200, description: 'Department updated' })
  @ApiStandardResponses()
  @CheckPermissions({ module: 'departments', action: 'edit' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete department' })
  @ApiResponse({ status: 200, description: 'Department deleted' })
  @ApiStandardResponses()
  @CheckPermissions({ module: 'departments', action: 'delete' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.remove(id);
  }
}
