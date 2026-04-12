import {
  DashboardOrganizationBranchesController,
  DashboardOrganizationDepartmentsController,
  DashboardOrganizationCategoriesController,
  DashboardOrganizationHoursController,
} from './organization.controller';

describe('DashboardOrganizationController barrel export', () => {
  it('exports DashboardOrganizationBranchesController', () => {
    expect(DashboardOrganizationBranchesController).toBeDefined();
  });

  it('exports DashboardOrganizationDepartmentsController', () => {
    expect(DashboardOrganizationDepartmentsController).toBeDefined();
  });

  it('exports DashboardOrganizationCategoriesController', () => {
    expect(DashboardOrganizationCategoriesController).toBeDefined();
  });

  it('exports DashboardOrganizationHoursController', () => {
    expect(DashboardOrganizationHoursController).toBeDefined();
  });
});
