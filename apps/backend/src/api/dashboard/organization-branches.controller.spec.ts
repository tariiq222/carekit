import { DashboardOrganizationBranchesController } from './organization-branches.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createBranch = fn({ id: 'br-1' });
  const listBranches = fn({ data: [] });
  const getBranch = fn({ id: 'br-1' });
  const updateBranch = fn({ id: 'br-1' });
  const controller = new DashboardOrganizationBranchesController(
    createBranch as never, updateBranch as never, listBranches as never, getBranch as never,
  );
  return { controller, createBranch, listBranches, getBranch, updateBranch };
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
});