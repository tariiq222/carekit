import { DashboardOrganizationBranchesController } from './organization-branches.controller';
import { REQUIRE_FEATURE_KEY } from '../../modules/platform/billing/feature.decorator';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createBranch = fn({ id: 'br-1' });
  const listBranches = fn({ data: [] });
  const getBranch = fn({ id: 'br-1' });
  const updateBranch = fn({ id: 'br-1' });
  const deleteBranch = fn({ id: 'br-1' });
  const listBranchEmployees = fn([]);
  const assignEmployee = fn({ id: 'asg-1' });
  const unassignEmployee = fn({ id: 'asg-1' });
  const controller = new DashboardOrganizationBranchesController(
    createBranch as never, updateBranch as never, listBranches as never, getBranch as never,
    deleteBranch as never, listBranchEmployees as never,
    assignEmployee as never, unassignEmployee as never,
  );
  return {
    controller, createBranch, listBranches, getBranch, updateBranch,
    deleteBranch, listBranchEmployees, assignEmployee, unassignEmployee,
  };
}

describe('DashboardOrganizationBranchesController', () => {
  it('createBranchEndpoint — passes body', async () => {
    const { controller, createBranch } = buildController();
    await controller.createBranchEndpoint({ nameAr: 'فرع' } as never);
    expect(createBranch.execute).toHaveBeenCalled();
  });

  it('listBranchesEndpoint — passes query', async () => {
    const { controller, listBranches } = buildController();
    await controller.listBranchesEndpoint({} as never);
    expect(listBranches.execute).toHaveBeenCalled();
  });

  it('getBranchEndpoint — passes branchId', async () => {
    const { controller, getBranch } = buildController();
    await controller.getBranchEndpoint('br-1');
    expect(getBranch.execute).toHaveBeenCalledWith({ branchId: 'br-1' });
  });

  it('updateBranchEndpoint — passes branchId', async () => {
    const { controller, updateBranch } = buildController();
    await controller.updateBranchEndpoint('br-1', {} as never);
    expect(updateBranch.execute).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'br-1' }),
    );
  });

  it('deleteBranchEndpoint — passes branchId', async () => {
    const { controller, deleteBranch } = buildController();
    await controller.deleteBranchEndpoint('br-1');
    expect(deleteBranch.execute).toHaveBeenCalledWith({ branchId: 'br-1' });
  });

  it('listBranchEmployeesEndpoint — passes branchId', async () => {
    const { controller, listBranchEmployees } = buildController();
    await controller.listBranchEmployeesEndpoint('br-1');
    expect(listBranchEmployees.execute).toHaveBeenCalledWith({ branchId: 'br-1' });
  });

  it('assignEmployeeEndpoint — passes branchId and employeeId', async () => {
    const { controller, assignEmployee } = buildController();
    await controller.assignEmployeeEndpoint('br-1', { employeeId: 'emp-1' } as never);
    expect(assignEmployee.execute).toHaveBeenCalledWith({
      branchId: 'br-1', employeeId: 'emp-1',
    });
  });

  it('unassignEmployeeEndpoint — passes branchId and employeeId', async () => {
    const { controller, unassignEmployee } = buildController();
    await controller.unassignEmployeeEndpoint('br-1', 'emp-1');
    expect(unassignEmployee.execute).toHaveBeenCalledWith({
      branchId: 'br-1', employeeId: 'emp-1',
    });
  });
});

describe('@RequireFeature metadata — MULTI_BRANCH', () => {
  it.each([
    'createBranchEndpoint',
    'updateBranchEndpoint',
  ])('annotates %s with FeatureKey.MULTI_BRANCH', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (DashboardOrganizationBranchesController.prototype as unknown as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.MULTI_BRANCH);
  });
});
