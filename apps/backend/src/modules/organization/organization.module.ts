import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { DashboardOrganizationController } from '../../api/dashboard/organization.controller';
import { DashboardOrganizationSettingsController } from '../../api/dashboard/organization-settings.controller';
import { CreateBranchHandler } from './branches/create-branch.handler';
import { UpdateBranchHandler } from './branches/update-branch.handler';
import { ListBranchesHandler } from './branches/list-branches.handler';
import { GetBranchHandler } from './branches/get-branch.handler';
import { CreateServiceHandler } from './services/create-service.handler';
import { UpdateServiceHandler } from './services/update-service.handler';
import { ListServicesHandler } from './services/list-services.handler';
import { ArchiveServiceHandler } from './services/archive-service.handler';
import { PriceResolverService } from './services/price-resolver.service';
import { SetDurationOptionsHandler } from './services/set-duration-options.handler';
import { SetEmployeeServiceOptionsHandler } from './services/set-employee-service-options.handler';
import { CreateDepartmentHandler } from './departments/create-department.handler';
import { UpdateDepartmentHandler } from './departments/update-department.handler';
import { ListDepartmentsHandler } from './departments/list-departments.handler';
import { CreateCategoryHandler } from './categories/create-category.handler';
import { UpdateCategoryHandler } from './categories/update-category.handler';
import { ListCategoriesHandler } from './categories/list-categories.handler';
import { SetBusinessHoursHandler } from './hours/set-business-hours.handler';
import { GetBusinessHoursHandler } from './hours/get-business-hours.handler';
import { AddHolidayHandler } from './hours/add-holiday.handler';
import { RemoveHolidayHandler } from './hours/remove-holiday.handler';
import { ListHolidaysHandler } from './hours/list-holidays.handler';
import { UpsertBrandingHandler } from './branding/upsert-branding.handler';
import { GetBrandingHandler } from './branding/get-branding.handler';
import { CreateIntakeFormHandler } from './intake-forms/create-intake-form.handler';
import { GetIntakeFormHandler } from './intake-forms/get-intake-form.handler';
import { ListIntakeFormsHandler } from './intake-forms/list-intake-forms.handler';
import { SubmitRatingHandler } from './ratings/submit-rating.handler';
import { ListRatingsHandler } from './ratings/list-ratings.handler';

const branchHandlers = [
  CreateBranchHandler, UpdateBranchHandler, ListBranchesHandler, GetBranchHandler,
];

const serviceHandlers = [
  CreateServiceHandler, UpdateServiceHandler, ListServicesHandler, ArchiveServiceHandler,
  PriceResolverService, SetDurationOptionsHandler, SetEmployeeServiceOptionsHandler,
];

const departmentHandlers = [
  CreateDepartmentHandler, UpdateDepartmentHandler, ListDepartmentsHandler,
];

const categoryHandlers = [
  CreateCategoryHandler, UpdateCategoryHandler, ListCategoriesHandler,
];

const hoursHandlers = [
  SetBusinessHoursHandler, GetBusinessHoursHandler,
  AddHolidayHandler, RemoveHolidayHandler, ListHolidaysHandler,
];

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardOrganizationController, DashboardOrganizationSettingsController],
  providers: [
    ...branchHandlers, ...serviceHandlers, ...departmentHandlers, ...categoryHandlers,
    ...hoursHandlers,
    UpsertBrandingHandler, GetBrandingHandler,
    CreateIntakeFormHandler, GetIntakeFormHandler, ListIntakeFormsHandler,
    SubmitRatingHandler, ListRatingsHandler,
  ],
  exports: [
    ...branchHandlers, ...serviceHandlers, ...departmentHandlers, ...categoryHandlers,
    ...hoursHandlers,
    UpsertBrandingHandler, GetBrandingHandler,
    CreateIntakeFormHandler, GetIntakeFormHandler, ListIntakeFormsHandler,
    SubmitRatingHandler, ListRatingsHandler,
  ],
})
export class OrganizationModule {}
