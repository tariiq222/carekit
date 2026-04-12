import { DashboardIdentityController } from './identity.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const listUsers = fn({ data: [], meta: {} });
  const createUser = fn({ id: 'u-1' });
  const updateUser = fn({ id: 'u-1' });
  const deactivateUser = fn();
  const listRoles = fn([]);
  const createRole = fn({ id: 'r-1' });
  const assignPermissions = fn();
  const controller = new DashboardIdentityController(
    listUsers as never, createUser as never, updateUser as never, deactivateUser as never,
    listRoles as never, createRole as never, assignPermissions as never,
  );
  return { controller, listUsers, createUser, updateUser, deactivateUser, listRoles, createRole, assignPermissions };
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
});