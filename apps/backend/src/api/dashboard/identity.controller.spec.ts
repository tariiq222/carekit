import { DashboardIdentityController } from './identity.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const listUsers = fn({ data: [], meta: {} });
  const createUser = fn({ id: 'u-1' });
  const updateUser = fn({ id: 'u-1' });
  const deactivateUser = fn();
  const deleteUser = fn();
  const assignRole = fn();
  const removeRole = fn();
  const listRoles = fn([]);
  const createRole = fn({ id: 'r-1' });
  const deleteRole = fn();
  const assignPermissions = fn();
  const controller = new DashboardIdentityController(
    listUsers as never, createUser as never, updateUser as never, deactivateUser as never,
    deleteUser as never, assignRole as never, removeRole as never,
    listRoles as never, createRole as never, deleteRole as never, assignPermissions as never,
  );
  return {
    controller, listUsers, createUser, updateUser, deactivateUser,
    deleteUser, assignRole, removeRole,
    listRoles, createRole, deleteRole, assignPermissions,
  };
}

describe('DashboardIdentityController', () => {
  it('should be defined', () => {
    const { controller } = buildController();
    expect(controller).toBeDefined();
  });

  it('listUsers calls handler with tenantId', async () => {
    const { controller, listUsers } = buildController();
    await controller.listUsers(TENANT, {} as never);
    expect(listUsers.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listRoles calls handler with tenantId', async () => {
    const { controller, listRoles } = buildController();
    await controller.listRoles(TENANT);
    expect(listRoles.execute).toHaveBeenCalledWith(TENANT);
  });

  it('deleteUserEndpoint passes tenantId and userId', async () => {
    const { controller, deleteUser } = buildController();
    await controller.deleteUserEndpoint(TENANT, 'u-1');
    expect(deleteUser.execute).toHaveBeenCalledWith({ tenantId: TENANT, userId: 'u-1' });
  });

  it('assignRoleEndpoint passes tenantId, userId, customRoleId', async () => {
    const { controller, assignRole } = buildController();
    await controller.assignRoleEndpoint(TENANT, 'u-1', { customRoleId: 'r-1' } as never);
    expect(assignRole.execute).toHaveBeenCalledWith({
      tenantId: TENANT, userId: 'u-1', customRoleId: 'r-1',
    });
  });

  it('removeRoleEndpoint passes tenantId, userId, roleId from path', async () => {
    const { controller, removeRole } = buildController();
    await controller.removeRoleEndpoint(TENANT, 'u-1', 'r-1');
    expect(removeRole.execute).toHaveBeenCalledWith({
      tenantId: TENANT, userId: 'u-1', customRoleId: 'r-1',
    });
  });

  it('deleteRoleEndpoint passes tenantId and customRoleId', async () => {
    const { controller, deleteRole } = buildController();
    await controller.deleteRoleEndpoint(TENANT, 'r-1');
    expect(deleteRole.execute).toHaveBeenCalledWith({ tenantId: TENANT, customRoleId: 'r-1' });
  });
});