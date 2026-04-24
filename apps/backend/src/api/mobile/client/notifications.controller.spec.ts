import { MobileClientNotificationsController } from './notifications.controller';

const USER = { id: 'client-1', email: null, phone: null };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function build() {
  const listNotifications = fn({ data: [], meta: {} });
  const markRead = fn({ updated: 3 });
  const controller = new MobileClientNotificationsController(listNotifications as never, markRead as never);
  return { controller, listNotifications, markRead };
}

describe('MobileClientNotificationsController', () => {
  it('listNotificationsEndpoint — passes recipientId, defaults', async () => {
    const { controller, listNotifications } = build();
    await controller.listNotificationsEndpoint(USER, {} as never);
    expect(listNotifications.execute).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: USER.id, page: 1, limit: 20,
    }));
  });

  it('listNotificationsEndpoint — passes unreadOnly filter', async () => {
    const { controller, listNotifications } = build();
    await controller.listNotificationsEndpoint(USER, { unreadOnly: true } as never);
    expect(listNotifications.execute).toHaveBeenCalledWith(expect.objectContaining({ unreadOnly: true }));
  });

  it('markReadEndpoint — passes recipientId from JWT', async () => {
    const { controller, markRead } = build();
    await controller.markReadEndpoint(USER);
    expect(markRead.execute).toHaveBeenCalledWith({ recipientId: USER.id });
  });
});
