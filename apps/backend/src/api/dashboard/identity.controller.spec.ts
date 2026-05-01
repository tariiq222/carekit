import { DashboardIdentityController } from './identity.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const listUsers = fn({ data: [], meta: {} });
  const getUser = fn({ id: 'u-1' });
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
  const listPermissions = fn([]);
  const controller = new DashboardIdentityController(
    listUsers as never, getUser as never, createUser as never, updateUser as never, deactivateUser as never,
    deleteUser as never, assignRole as never, removeRole as never,
    listRoles as never, createRole as never, deleteRole as never, assignPermissions as never,
    listPermissions as never,
  );
  return {
    controller, listUsers, getUser, createUser, updateUser, deactivateUser,
    deleteUser, assignRole, removeRole,
    listRoles, createRole, deleteRole, assignPermissions, listPermissions,
  };
}

describe('DashboardIdentityController', () => {
  it('should be defined', () => {
    const { controller } = buildController();
    expect(controller).toBeDefined();
  });

  it('listUsers calls handler', async () => {
    const { controller, listUsers } = buildController();
    await controller.listUsers({} as never);
    expect(listUsers.execute).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
  });

  it('getUserEndpoint passes userId', async () => {
    const { controller, getUser } = buildController();
    await controller.getUserEndpoint('u-1');
    expect(getUser.execute).toHaveBeenCalledWith({ userId: 'u-1' });
  });

  it('updateUserEndpoint accepts editable fields', async () => {
    const { controller, updateUser } = buildController();
    await controller.updateUserEndpoint('u-1', {
      email: 'updated@clinic.sa',
      name: 'Updated',
      gender: 'FEMALE',
      role: 'ACCOUNTANT',
    } as never);
    expect(updateUser.execute).toHaveBeenCalledWith({
      userId: 'u-1',
      email: 'updated@clinic.sa',
      name: 'Updated',
      gender: 'FEMALE',
      role: 'ACCOUNTANT',
    });
  });

  it('listRoles calls handler', async () => {
    const { controller, listRoles } = buildController();
    await controller.listRoles();
    expect(listRoles.execute).toHaveBeenCalledWith();
  });

  it('deleteUserEndpoint passes userId', async () => {
    const { controller, deleteUser } = buildController();
    await controller.deleteUserEndpoint('u-1');
    expect(deleteUser.execute).toHaveBeenCalledWith({ userId: 'u-1' });
  });

  it('assignRoleEndpoint passes userId, customRoleId', async () => {
    const { controller, assignRole } = buildController();
    await controller.assignRoleEndpoint('u-1', { customRoleId: 'r-1' } as never);
    expect(assignRole.execute).toHaveBeenCalledWith({
      userId: 'u-1', customRoleId: 'r-1',
    });
  });

  it('removeRoleEndpoint passes userId, roleId from path', async () => {
    const { controller, removeRole } = buildController();
    await controller.removeRoleEndpoint('u-1', 'r-1');
    expect(removeRole.execute).toHaveBeenCalledWith({
      userId: 'u-1', customRoleId: 'r-1',
    });
  });

  it('deleteRoleEndpoint passes customRoleId', async () => {
    const { controller, deleteRole } = buildController();
    await controller.deleteRoleEndpoint('r-1');
    expect(deleteRole.execute).toHaveBeenCalledWith({ customRoleId: 'r-1' });
  });
});
