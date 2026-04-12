import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
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
import { CreateServiceHandler } from '../../modules/org-experience/services/create-service.handler';
import { CreateServiceDto } from '../../modules/org-experience/services/create-service.dto';
import { UpdateServiceHandler } from '../../modules/org-experience/services/update-service.handler';
import { UpdateServiceDto } from '../../modules/org-experience/services/update-service.dto';
import { ListServicesHandler } from '../../modules/org-experience/services/list-services.handler';
import { ListServicesDto } from '../../modules/org-experience/services/list-services.dto';
import { ArchiveServiceHandler } from '../../modules/org-experience/services/archive-service.handler';
import { CreateDepartmentHandler } from '../../modules/org-config/departments/create-department.handler';
import { CreateDepartmentDto } from '../../modules/org-config/departments/create-department.dto';
import { UpdateDepartmentHandler } from '../../modules/org-config/departments/update-department.handler';
import { UpdateDepartmentDto } from '../../modules/org-config/departments/update-department.dto';
import { ListDepartmentsHandler } from '../../modules/org-config/departments/list-departments.handler';
import { ListDepartmentsDto } from '../../modules/org-config/departments/list-departments.dto';
import { CreateCategoryHandler } from '../../modules/org-config/categories/create-category.handler';
import { CreateCategoryDto } from '../../modules/org-config/categories/create-category.dto';
import { UpdateCategoryHandler } from '../../modules/org-config/categories/update-category.handler';
import { UpdateCategoryDto } from '../../modules/org-config/categories/update-category.dto';
import { ListCategoriesHandler } from '../../modules/org-config/categories/list-categories.handler';
import { ListCategoriesDto } from '../../modules/org-config/categories/list-categories.dto';
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

  // ── Services ──────────────────────────────────────────────────────────────

  @Post('services')
  createServiceEndpoint(
    @TenantId() tenantId: string,
    @Body() body: CreateServiceDto,
  ) {
    return this.createService.execute({ tenantId, ...body });
  }

  @Get('services')
  listServicesEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListServicesDto,
  ) {
    return this.listServices.execute({ tenantId, ...query });
  }

  @Patch('services/:serviceId')
  updateServiceEndpoint(
    @TenantId() tenantId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: UpdateServiceDto,
  ) {
    return this.updateService.execute({ tenantId, serviceId, ...body });
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
    @Body() body: CreateDepartmentDto,
  ) {
    return this.createDepartment.execute({ tenantId, ...body });
  }

  @Get('departments')
  listDepartmentsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListDepartmentsDto,
  ) {
    return this.listDepartments.execute({ tenantId, ...query });
  }

  @Patch('departments/:departmentId')
  updateDepartmentEndpoint(
    @TenantId() tenantId: string,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() body: UpdateDepartmentDto,
  ) {
    return this.updateDepartment.execute({ tenantId, departmentId, ...body });
  }

  // ── Categories ────────────────────────────────────────────────────────────

  @Post('categories')
  createCategoryEndpoint(
    @TenantId() tenantId: string,
    @Body() body: CreateCategoryDto,
  ) {
    return this.createCategory.execute({ tenantId, ...body });
  }

  @Get('categories')
  listCategoriesEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListCategoriesDto,
  ) {
    return this.listCategories.execute({ tenantId, ...query });
  }

  @Patch('categories/:categoryId')
  updateCategoryEndpoint(
    @TenantId() tenantId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.updateCategory.execute({ tenantId, categoryId, ...body });
  }

  // ── Business Hours ────────────────────────────────────────────────────────

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

  // ── Holidays ──────────────────────────────────────────────────────────────

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
