import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateBranchHandler } from '../../modules/org-config/branches/create-branch.handler';
import { CreateBranchDto } from '../../modules/org-config/branches/create-branch.dto';
import { UpdateBranchHandler } from '../../modules/org-config/branches/update-branch.handler';
import { UpdateBranchDto } from '../../modules/org-config/branches/update-branch.dto';
import { ListBranchesHandler } from '../../modules/org-config/branches/list-branches.handler';
import { ListBranchesDto } from '../../modules/org-config/branches/list-branches.dto';
import { GetBranchHandler } from '../../modules/org-config/branches/get-branch.handler';
import { DeleteBranchHandler } from '../../modules/org-config/branches/delete-branch.handler';
import { ListBranchEmployeesHandler } from '../../modules/org-config/branches/list-branch-employees.handler';
import { AssignEmployeeToBranchHandler } from '../../modules/org-config/branches/assign-employee-to-branch.handler';
import { AssignEmployeeToBranchDto } from '../../modules/org-config/branches/assign-employee-to-branch.dto';
import { UnassignEmployeeFromBranchHandler } from '../../modules/org-config/branches/unassign-employee-from-branch.handler';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationBranchesController {
  constructor(
    private readonly createBranch: CreateBranchHandler,
    private readonly updateBranch: UpdateBranchHandler,
    private readonly listBranches: ListBranchesHandler,
    private readonly getBranch: GetBranchHandler,
    private readonly deleteBranch: DeleteBranchHandler,
    private readonly listBranchEmployees: ListBranchEmployeesHandler,
    private readonly assignEmployee: AssignEmployeeToBranchHandler,
    private readonly unassignEmployee: UnassignEmployeeFromBranchHandler,
  ) {}

  @Post('branches')
  createBranchEndpoint(
    @TenantId() tenantId: string,
    @Body() body: CreateBranchDto,
  ) {
    return this.createBranch.execute({ tenantId, ...body });
  }

  @Get('branches')
  listBranchesEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListBranchesDto,
  ) {
    return this.listBranches.execute({ tenantId, ...query });
  }

  @Get('branches/:branchId')
  getBranchEndpoint(
    @TenantId() tenantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.getBranch.execute({ tenantId, branchId });
  }

  @Patch('branches/:branchId')
  updateBranchEndpoint(
    @TenantId() tenantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() body: UpdateBranchDto,
  ) {
    return this.updateBranch.execute({ tenantId, branchId, ...body });
  }

  @Delete('branches/:branchId')
  deleteBranchEndpoint(
    @TenantId() tenantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.deleteBranch.execute({ tenantId, branchId });
  }

  @Get('branches/:branchId/employees')
  listBranchEmployeesEndpoint(
    @TenantId() tenantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.listBranchEmployees.execute({ tenantId, branchId });
  }

  @Post('branches/:branchId/employees')
  assignEmployeeEndpoint(
    @TenantId() tenantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() body: AssignEmployeeToBranchDto,
  ) {
    return this.assignEmployee.execute({ tenantId, branchId, ...body });
  }

  @Delete('branches/:branchId/employees/:employeeId')
  unassignEmployeeEndpoint(
    @TenantId() tenantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.unassignEmployee.execute({ tenantId, branchId, employeeId });
  }
}
