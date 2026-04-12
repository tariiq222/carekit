import { MobileClientNotificationsController } from './notifications.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'client-1', tenantId: TENANT, role: 'CLIENT' };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function build() {
  const listNotifications = fn({ data: [], meta: {} });
  const markRead = fn({ updated: 3 });
  const controller = new MobileClientNotificationsController(listNotifications as never, markRead as never);
  return { controller, listNotifications, markRead };
}

describe('MobileClientNotificationsController', () => {
  it('listNotificationsEndpoint — passes tenantId, recipientId, defaults', async () => {
    const { controller, listNotifications } = build();
    await controller.listNotificationsEndpoint(TENANT, USER, {} as never);
    expect(listNotifications.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT, recipientId: USER.sub, page: 1, limit: 20,
    }));
  });

  it('listNotificationsEndpoint — passes unreadOnly filter', async () => {
    const { controller, listNotifications } = build();
    await controller.listNotificationsEndpoint(TENANT, USER, { unreadOnly: true } as never);
    expect(listNotifications.execute).toHaveBeenCalledWith(expect.objectContaining({ unreadOnly: true }));
  });

  it('markReadEndpoint — passes tenantId and recipientId from JWT', async () => {
    const { controller, markRead } = build();
    await controller.markReadEndpoint(TENANT, USER);
    expect(markRead.execute).toHaveBeenCalledWith({ tenantId: TENANT, recipientId: USER.sub });
  });
});
