import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
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
  createDepartmentEndpoint(
    @TenantId() tenantId: string,
    @Body() body: CreateDepartmentDto,
  ) {
    return this.createDepartment.execute({ tenantId, ...body });
  }

  @Get('departments')
  @CheckPermissions({ action: 'read', subject: 'Department' })
  listDepartmentsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListDepartmentsDto,
  ) {
    return this.listDepartments.execute({ tenantId, ...query });
  }

  @Patch('departments/:departmentId')
  @CheckPermissions({ action: 'update', subject: 'Department' })
  updateDepartmentEndpoint(
    @TenantId() tenantId: string,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() body: UpdateDepartmentDto,
  ) {
    return this.updateDepartment.execute({ tenantId, departmentId, ...body });
  }

  @Delete('departments/:departmentId')
  @CheckPermissions({ action: 'delete', subject: 'Department' })
  deleteDepartmentEndpoint(
    @TenantId() tenantId: string,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ) {
    return this.deleteDepartment.execute({ tenantId, departmentId });
  }
}
