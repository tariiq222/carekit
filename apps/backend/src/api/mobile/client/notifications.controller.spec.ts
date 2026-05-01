import { MobileClientNotificationsController } from './notifications.controller';

const USER = { id: 'client-1', email: null, phone: null };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });
const mockTenant = { requireOrganizationIdOrDefault: jest.fn().mockReturnValue('org-1') };

function build() {
  const listNotifications = fn({ data: [], meta: {} });
  const markRead = fn({ updated: 3 });
  const getUnreadCount = fn({ count: 4 });
  const registerFcm = fn({ id: 't1' });
  const unregisterFcm = fn({ deleted: 1 });
  const controller = new MobileClientNotificationsController(
    listNotifications as never,
    markRead as never,
    getUnreadCount as never,
    registerFcm as never,
    unregisterFcm as never,
    mockTenant as never,
  );
  return { controller, listNotifications, markRead, getUnreadCount, registerFcm, unregisterFcm };
}

describe('MobileClientNotificationsController', () => {
  it('listNotificationsEndpoint — passes recipientId, defaults', async () => {
    const { controller, listNotifications } = build();
    await controller.listNotificationsEndpoint(USER, {} as never);
    expect(listNotifications.execute).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1', recipientId: USER.id, page: 1, limit: 20,
    }));
  });

  it('listNotificationsEndpoint — passes unreadOnly filter', async () => {
    const { controller, listNotifications } = build();
    await controller.listNotificationsEndpoint(USER, { unreadOnly: true } as never);
    expect(listNotifications.execute).toHaveBeenCalledWith(expect.objectContaining({ unreadOnly: true }));
  });

  it('markReadEndpoint — passes recipientId from JWT (mark all)', async () => {
    const { controller, markRead } = build();
    await controller.markReadEndpoint(USER);
    expect(markRead.execute).toHaveBeenCalledWith({ organizationId: 'org-1', recipientId: USER.id });
  });

  it('markReadEndpoint — passes notificationId when provided', async () => {
    const { controller, markRead } = build();
    await controller.markReadEndpoint(USER, { notificationId: 'n-1' });
    expect(markRead.execute).toHaveBeenCalledWith({
      organizationId: 'org-1',
      recipientId: USER.id,
      notificationId: 'n-1',
    });
  });

  it('getUnreadCountEndpoint — returns count for the JWT user', async () => {
    const { controller, getUnreadCount } = build();
    await controller.getUnreadCountEndpoint(USER);
    expect(getUnreadCount.execute).toHaveBeenCalledWith({ organizationId: 'org-1', recipientId: USER.id });
  });

  it('registerFcmEndpoint — forwards clientId + body', async () => {
    const { controller, registerFcm } = build();
    await controller.registerFcmEndpoint(USER, { token: 'tok-A', platform: 'ios' });
    expect(registerFcm.execute).toHaveBeenCalledWith({
      clientId: USER.id, token: 'tok-A', platform: 'ios',
    });
  });

  it('unregisterFcmEndpoint — clears all tokens for the client', async () => {
    const { controller, unregisterFcm } = build();
    await controller.unregisterFcmEndpoint(USER);
    expect(unregisterFcm.execute).toHaveBeenCalledWith({ clientId: USER.id });
  });
});
