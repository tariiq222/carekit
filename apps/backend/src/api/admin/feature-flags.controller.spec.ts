import { AdminFeatureFlagsController } from './feature-flags.controller';

const fn = <T = unknown>(val: T = { success: true } as T) => ({
  execute: jest.fn().mockResolvedValue(val),
});

function buildController() {
  const listHandler = fn();
  const updateHandler = fn();
  const upsertOverrideHandler = fn();
  const controller = new AdminFeatureFlagsController(
    listHandler as never,
    updateHandler as never,
    upsertOverrideHandler as never,
  );
  return { controller, listHandler, updateHandler, upsertOverrideHandler };
}

describe('AdminFeatureFlagsController', () => {
  const user = { sub: 'admin-1' };

  it('list — delegates to listHandler with organizationId', async () => {
    const { controller, listHandler } = buildController();
    await controller.list('org-1');
    expect(listHandler.execute).toHaveBeenCalledWith({ organizationId: 'org-1' });
  });

  it('upsertOverride — calls handler with correct args from dto and user', async () => {
    const { controller, upsertOverrideHandler } = buildController();
    const dto = {
      organizationId: 'org-1',
      key: 'coupons',
      mode: 'FORCE_ON' as const,
      reason: 'Pilot customer requires coupons on Basic plan',
    };
    const result = await controller.upsertOverride(dto as never, user);
    expect(upsertOverrideHandler.execute).toHaveBeenCalledWith({
      organizationId: 'org-1',
      key: 'coupons',
      mode: 'FORCE_ON',
      reason: 'Pilot customer requires coupons on Basic plan',
      superAdminUserId: 'admin-1',
    });
    expect(result).toEqual({ success: true });
  });

  it('upsertOverride — uses user.id when sub is absent', async () => {
    const { controller, upsertOverrideHandler } = buildController();
    const dto = {
      organizationId: 'org-1',
      key: 'coupons',
      mode: 'INHERIT' as const,
      reason: 'Reverting pilot override after trial ended',
    };
    await controller.upsertOverride(dto as never, { id: 'admin-2' } as never);
    expect(upsertOverrideHandler.execute).toHaveBeenCalledWith(expect.objectContaining({
      superAdminUserId: 'admin-2',
    }));
  });

  it('upsertOverride — FORCE_OFF passes mode correctly', async () => {
    const { controller, upsertOverrideHandler } = buildController();
    const dto = {
      organizationId: 'org-1',
      key: 'waitlist',
      mode: 'FORCE_OFF' as const,
      reason: 'Compliance review requires disabling waitlist',
    };
    await controller.upsertOverride(dto as never, user);
    expect(upsertOverrideHandler.execute).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'FORCE_OFF',
    }));
  });
});
