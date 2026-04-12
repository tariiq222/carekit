import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateBranchHandler } from '../../modules/organization/branches/create-branch.handler';
import { UpdateBranchHandler } from '../../modules/organization/branches/update-branch.handler';
import { ListBranchesHandler } from '../../modules/organization/branches/list-branches.handler';
import { GetBranchHandler } from '../../modules/organization/branches/get-branch.handler';
import { CreateServiceHandler } from '../../modules/organization/services/create-service.handler';
import { UpdateServiceHandler } from '../../modules/organization/services/update-service.handler';
import { ListServicesHandler } from '../../modules/organization/services/list-services.handler';
import { ArchiveServiceHandler } from '../../modules/organization/services/archive-service.handler';
import { CreateDepartmentHandler } from '../../modules/organization/departments/create-department.handler';
import { UpdateDepartmentHandler } from '../../modules/organization/departments/update-department.handler';
import { ListDepartmentsHandler } from '../../modules/organization/departments/list-departments.handler';
import { CreateCategoryHandler } from '../../modules/organization/categories/create-category.handler';
import { UpdateCategoryHandler } from '../../modules/organization/categories/update-category.handler';
import { ListCategoriesHandler } from '../../modules/organization/categories/list-categories.handler';
import { SetBusinessHoursHandler } from '../../modules/organization/hours/set-business-hours.handler';
import { GetBusinessHoursHandler } from '../../modules/organization/hours/get-business-hours.handler';
import { AddHolidayHandler } from '../../modules/organization/hours/add-holiday.handler';
import { RemoveHolidayHandler } from '../../modules/organization/hours/remove-holiday.handler';
import { ListHolidaysHandler } from '../../modules/organization/hours/list-holidays.handler';

@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationController {
  constructor(
    private readonly createBranch: CreateBranchHandler,
    private readonly updateBranch: UpdateBranchHandler,
    private readonly listBranches: ListBranchesHandler,
    private readonly getBranch: GetBranchHandler,
    private readonly createService: CreateServiceHandler,
    private readonly updateService: UpdateServiceHandler,
    private readonly listServices: ListServicesHandler,
    private readonly archiveService: ArchiveServiceHandler,
    private readonly createDepartment: CreateDepartmentHandler,
    private readonly updateDepartment: UpdateDepartmentHandler,
    private readonly listDepartments: ListDepartmentsHandler,
    private readonly createCategory: CreateCategoryHandler,
    private readonly updateCategory: UpdateCategoryHandler,
    private readonly listCategories: ListCategoriesHandler,
    private readonly setBusinessHours: SetBusinessHoursHandler,
    private readonly getBusinessHours: GetBusinessHoursHandler,
    private readonly addHoliday: AddHolidayHandler,
    private readonly removeHoliday: RemoveHolidayHandler,
    private readonly listHolidays: ListHolidaysHandler,
  ) {}

  // ── Branches ──────────────────────────────────────────────────────────────

  @Post('branches')
  createBranchEndpoint(
    @TenantId() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.createBranch.execute({ tenantId, ...body } as Parameters<typeof this.createBranch.execute>[0]);
  }

  @Get('branches')
  listBranchesEndpoint(
    @TenantId() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.listBranches.execute({ tenantId, ...query } as Parameters<typeof this.listBranches.execute>[0]);
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
    @Body() body: Record<string, unknown>,
  ) {
    return this.updateBranch.execute({ tenantId, branchId, ...body } as Parameters<typeof this.updateBranch.execute>[0]);
  }

  // ── Services ──────────────────────────────────────────────────────────────

  @Post('services')
  createServiceEndpoint(
    @TenantId() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.createService.execute({ tenantId, ...body } as Parameters<typeof this.createService.execute>[0]);
  }

  @Get('services')
  listServicesEndpoint(
    @TenantId() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.listServices.execute({ tenantId, ...query } as Parameters<typeof this.listServices.execute>[0]);
  }

  @Patch('services/:serviceId')
  updateServiceEndpoint(
    @TenantId() tenantId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.updateService.execute({ tenantId, serviceId, ...body } as Parameters<typeof this.updateService.execute>[0]);
  }

  @Delete('services/:serviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  archiveServiceEndpoint(
    @TenantId() tenantId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.archiveService.execute({ tenantId, serviceId });
  }

  // ── Departments ───────────────────────────────────────────────────────────

  @Post('departments')
  createDepartmentEndpoint(
    @TenantId() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.createDepartment.execute({ tenantId, ...body } as Parameters<typeof this.createDepartment.execute>[0]);
  }

  @Get('departments')
  listDepartmentsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.listDepartments.execute({ tenantId, ...query } as Parameters<typeof this.listDepartments.execute>[0]);
  }

  @Patch('departments/:departmentId')
  updateDepartmentEndpoint(
    @TenantId() tenantId: string,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.updateDepartment.execute({ tenantId, departmentId, ...body } as Parameters<typeof this.updateDepartment.execute>[0]);
  }

  // ── Categories ────────────────────────────────────────────────────────────

  @Post('categories')
  createCategoryEndpoint(
    @TenantId() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.createCategory.execute({ tenantId, ...body } as Parameters<typeof this.createCategory.execute>[0]);
  }

  @Get('categories')
  listCategoriesEndpoint(
    @TenantId() tenantId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.listCategories.execute({ tenantId, ...query } as Parameters<typeof this.listCategories.execute>[0]);
  }

  @Patch('categories/:categoryId')
  updateCategoryEndpoint(
    @TenantId() tenantId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.updateCategory.execute({ tenantId, categoryId, ...body } as Parameters<typeof this.updateCategory.execute>[0]);
  }

  // ── Business Hours ────────────────────────────────────────────────────────

  @Post('hours')
  setBusinessHoursEndpoint(
    @TenantId() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.setBusinessHours.execute({ tenantId, ...body } as Parameters<typeof this.setBusinessHours.execute>[0]);
  }

  @Get('hours/:branchId')
  getBusinessHoursEndpoint(
    @TenantId() tenantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.getBusinessHours.execute({ tenantId, branchId });
  }

  // ── Holidays ──────────────────────────────────────────────────────────────

  @Post('holidays')
  addHolidayEndpoint(
    @TenantId() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.addHoliday.execute({ tenantId, ...body } as Parameters<typeof this.addHoliday.execute>[0]);
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
    @Query() query: Record<string, unknown>,
  ) {
    return this.listHolidays.execute({ tenantId, ...query } as Parameters<typeof this.listHolidays.execute>[0]);
  }
}
