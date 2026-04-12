import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
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

@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationBranchesController {
  constructor(
    private readonly createBranch: CreateBranchHandler,
    private readonly updateBranch: UpdateBranchHandler,
    private readonly listBranches: ListBranchesHandler,
    private readonly getBranch: GetBranchHandler,
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
}
