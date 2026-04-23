import { DashboardIdentityController } from './identity.controller';

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
  const listPermissions = fn([]);
  const listMembers = fn({ items: [], meta: {} });
  const inviteMember = fn({ invitationId: 'inv-1' });
  const updateMemberRole = fn();
  const deactivateMember = fn();
  const listInvitations = fn({ items: [], meta: {} });
  const revokeInvitation = fn();
  const controller = new DashboardIdentityController(
    listUsers as never, createUser as never, updateUser as never, deactivateUser as never,
    deleteUser as never, assignRole as never, removeRole as never,
    listRoles as never, createRole as never, deleteRole as never, assignPermissions as never,
    listPermissions as never, listMembers as never, inviteMember as never,
    updateMemberRole as never, deactivateMember as never, listInvitations as never,
    revokeInvitation as never,
  );
  return {
    controller, listUsers, createUser, updateUser, deactivateUser,
    deleteUser, assignRole, removeRole,
    listRoles, createRole, deleteRole, assignPermissions, listPermissions,
    listMembers, inviteMember, updateMemberRole, deactivateMember, listInvitations, revokeInvitation,
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
