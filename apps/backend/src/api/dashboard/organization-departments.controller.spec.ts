import { DashboardOrganizationDepartmentsController } from './organization-departments.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createDepartment = fn({ id: 'dept-1' });
  const updateDepartment = fn({ id: 'dept-1' });
  const listDepartments = fn({ data: [] });
  const controller = new DashboardOrganizationDepartmentsController(
    createDepartment as never, updateDepartment as never, listDepartments as never,
  );
  return { controller, createDepartment, updateDepartment, listDepartments };
}

describe('DashboardOrganizationDepartmentsController', () => {
  it('createDepartmentEndpoint — passes tenantId', async () => {
    const { controller, createDepartment } = buildController();
    await controller.createDepartmentEndpoint(TENANT, { nameAr: 'قسم' } as never);
    expect(createDepartment.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listDepartmentsEndpoint — passes tenantId', async () => {
    const { controller, listDepartments } = buildController();
    await controller.listDepartmentsEndpoint(TENANT, {} as never);
    expect(listDepartments.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('updateDepartmentEndpoint — passes tenantId and departmentId', async () => {
    const { controller, updateDepartment } = buildController();
    await controller.updateDepartmentEndpoint(TENANT, 'dept-1', {} as never);
    expect(updateDepartment.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, departmentId: 'dept-1' }),
    );
  });
});