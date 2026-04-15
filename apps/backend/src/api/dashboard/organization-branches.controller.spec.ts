import { DashboardOrganizationBranchesController } from './organization-branches.controller';

const TENANT = 'tenant-1';
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
  it('createBranchEndpoint — passes tenantId', async () => {
    const { controller, createBranch } = buildController();
    await controller.createBranchEndpoint(TENANT, { nameAr: 'فرع' } as never);
    expect(createBranch.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listBranchesEndpoint — passes tenantId', async () => {
    const { controller, listBranches } = buildController();
    await controller.listBranchesEndpoint(TENANT, {} as never);
    expect(listBranches.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('getBranchEndpoint — passes tenantId and branchId', async () => {
    const { controller, getBranch } = buildController();
    await controller.getBranchEndpoint(TENANT, 'br-1');
    expect(getBranch.execute).toHaveBeenCalledWith({ tenantId: TENANT, branchId: 'br-1' });
  });

  it('updateBranchEndpoint — passes tenantId and branchId', async () => {
    const { controller, updateBranch } = buildController();
    await controller.updateBranchEndpoint(TENANT, 'br-1', {} as never);
    expect(updateBranch.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, branchId: 'br-1' }),
    );
  });

  it('deleteBranchEndpoint — passes tenantId and branchId', async () => {
    const { controller, deleteBranch } = buildController();
    await controller.deleteBranchEndpoint(TENANT, 'br-1');
    expect(deleteBranch.execute).toHaveBeenCalledWith({ tenantId: TENANT, branchId: 'br-1' });
  });

  it('listBranchEmployeesEndpoint — passes tenantId and branchId', async () => {
    const { controller, listBranchEmployees } = buildController();
    await controller.listBranchEmployeesEndpoint(TENANT, 'br-1');
    expect(listBranchEmployees.execute).toHaveBeenCalledWith({ tenantId: TENANT, branchId: 'br-1' });
  });

  it('assignEmployeeEndpoint — passes tenantId, branchId, and employeeId', async () => {
    const { controller, assignEmployee } = buildController();
    await controller.assignEmployeeEndpoint(TENANT, 'br-1', { employeeId: 'emp-1' } as never);
    expect(assignEmployee.execute).toHaveBeenCalledWith({
      tenantId: TENANT, branchId: 'br-1', employeeId: 'emp-1',
    });
  });

  it('unassignEmployeeEndpoint — passes tenantId, branchId, and employeeId', async () => {
    const { controller, unassignEmployee } = buildController();
    await controller.unassignEmployeeEndpoint(TENANT, 'br-1', 'emp-1');
    expect(unassignEmployee.execute).toHaveBeenCalledWith({
      tenantId: TENANT, branchId: 'br-1', employeeId: 'emp-1',
    });
  });
});