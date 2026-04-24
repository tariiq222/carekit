import { MobileClientHomeController } from './home.controller';
import { ClientSession } from '../../../../common/auth/client-session.decorator';

const USER: ClientSession = { id: 'client-1', email: null, phone: null };

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const listBookings = fn({ data: [{ id: 'b-1' }], meta: {} });
  const listNotifications = fn({ data: [{ id: 'n-1' }], meta: {} });
  const listPayments = fn({ data: [{ id: 'p-1' }], meta: {} });
  const getClient = fn({ id: 'client-1', name: 'Test Client' });

  const controller = new MobileClientHomeController(
    listBookings as never,
    listNotifications as never,
    listPayments as never,
    getClient as never,
  );

  return { controller, listBookings, listNotifications, listPayments, getClient };
}

describe('MobileClientHomeController', () => {
  it('home — fetches all data in parallel', async () => {
    const { controller, listBookings, listNotifications, listPayments, getClient } = buildController();
    const now = new Date();

    await controller.home(USER);

    expect(listBookings.execute).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: USER.id, fromDate: now, page: 1, limit: 5 }),
    );
    expect(listNotifications.execute).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: USER.id, unreadOnly: true, page: 1, limit: 5 }),
    );
    expect(listPayments.execute).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: USER.id, page: 1, limit: 3 }),
    );
    expect(getClient.execute).toHaveBeenCalledWith({ clientId: USER.id });
  });

  it('home — returns formatted response', async () => {
    const { controller } = buildController();
    const result = await controller.home(USER);

    expect(result).toHaveProperty('profile');
    expect(result).toHaveProperty('upcomingBookings');
    expect(result).toHaveProperty('unreadNotifications');
    expect(result).toHaveProperty('recentPayments');
  });

  it('home — unwraps paginated results with data property', async () => {
    const bookingsResult = { data: [{ id: 'b-1' }], meta: { total: 1 } };
    const notificationsResult = { data: [{ id: 'n-1' }], meta: { total: 1 } };
    const paymentsResult = { data: [{ id: 'p-1' }], meta: { total: 1 } };
    const clientResult = { id: 'client-1', name: 'Test Client' };

    const listBookings = fn(bookingsResult);
    const listNotifications = fn(notificationsResult);
    const listPayments = fn(paymentsResult);
    const getClient = fn(clientResult);

    const controller = new MobileClientHomeController(
      listBookings as never,
      listNotifications as never,
      listPayments as never,
      getClient as never,
    );

    const result = await controller.home(USER);

    expect(result.upcomingBookings).toEqual(bookingsResult.data);
    expect(result.unreadNotifications).toEqual(notificationsResult.data);
    expect(result.recentPayments).toEqual(paymentsResult.data);
    expect(result.profile).toEqual(clientResult);
  });
});
