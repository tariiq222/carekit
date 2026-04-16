import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { CreateDepartmentHandler } from '../../modules/org-config/departments/create-department.handler';
import { CreateDepartmentDto } from '../../modules/org-config/departments/create-department.dto';
import { UpdateDepartmentHandler } from '../../modules/org-config/departments/update-department.handler';
import { UpdateDepartmentDto } from '../../modules/org-config/departments/update-department.dto';
import { ListDepartmentsHandler } from '../../modules/org-config/departments/list-departments.handler';
import { ListDepartmentsDto } from '../../modules/org-config/departments/list-departments.dto';
import { DeleteDepartmentHandler } from '../../modules/org-config/departments/delete-department.handler';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationDepartmentsController {
  constructor(
    private readonly createDepartment: CreateDepartmentHandler,
    private readonly updateDepartment: UpdateDepartmentHandler,
    private readonly listDepartments: ListDepartmentsHandler,
    private readonly deleteDepartment: DeleteDepartmentHandler,
  ) {}

  @Post('departments')
  @CheckPermissions({ action: 'create', subject: 'Department' })
  createDepartmentEndpoint(@Body() body: CreateDepartmentDto) {
    return this.createDepartment.execute(body);
  }

  @Get('departments')
  @CheckPermissions({ action: 'read', subject: 'Department' })
  listDepartmentsEndpoint(@Query() query: ListDepartmentsDto) {
    return this.listDepartments.execute(query);
  }

  @Patch('departments/:departmentId')
  @CheckPermissions({ action: 'update', subject: 'Department' })
  updateDepartmentEndpoint(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() body: UpdateDepartmentDto,
  ) {
    return this.updateDepartment.execute({ departmentId, ...body });
  }

  @Delete('departments/:departmentId')
  @CheckPermissions({ action: 'delete', subject: 'Department' })
  deleteDepartmentEndpoint(@Param('departmentId', ParseUUIDPipe) departmentId: string) {
    return this.deleteDepartment.execute({ departmentId });
  }
}
