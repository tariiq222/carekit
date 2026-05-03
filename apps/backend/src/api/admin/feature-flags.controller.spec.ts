import { AdminFeatureFlagsController } from './feature-flags.controller';

const fn = <T = unknown>(val: T = { success: true } as T) => ({
  execute: jest.fn().mockResolvedValue(val),
});

function buildController() {
  const listHandler = fn();
  const updateHandler = fn();
  const controller = new AdminFeatureFlagsController(
    listHandler as never,
    updateHandler as never,
  );
  return { controller, listHandler, updateHandler };
}

describe('AdminFeatureFlagsController', () => {
  const user = { sub: 'admin-1' };

  it('list — delegates to listHandler with organizationId', async () => {
    const { controller, listHandler } = buildController();
    await controller.list('org-1');
    expect(listHandler.execute).toHaveBeenCalledWith({ organizationId: 'org-1' });
  });

  it('update — delegates to updateHandler with correct args', async () => {
    const { controller, updateHandler } = buildController();
    const dto = {
      organizationId: 'org-1',
      enabled: true,
      reason: 'Pilot customer requires feature enabled on Basic plan',
    };
    const req = { ip: '127.0.0.1', headers: { 'user-agent': 'test-agent' } } as never;
    await controller.update('some_feature', dto as never, user, req);
    expect(updateHandler.execute).toHaveBeenCalledWith({
      organizationId: 'org-1',
      key: 'some_feature',
      enabled: true,
      superAdminUserId: 'admin-1',
      reason: 'Pilot customer requires feature enabled on Basic plan',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
  });
});
