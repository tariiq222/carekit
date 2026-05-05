import { DashboardStatsController } from './stats.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const getStats = fn({
    todayBookings: 5,
    confirmedToday: 3,
    pendingToday: 2,
    pendingPayments: 1,
    cancelRequests: 0,
    todayRevenue: 450.0,
  });
  const controller = new DashboardStatsController(getStats as never);
  return { controller, getStats };
}

const reqWithRole = (membershipRole: string | null = 'OWNER') =>
  ({ user: { membershipRole } } as never);

describe('DashboardStatsController', () => {
  it('getStatsEndpoint — delegates to handler with command', async () => {
    const { controller, getStats } = buildController();
    await controller.getStatsEndpoint('user-1', reqWithRole('OWNER'));
    expect(getStats.execute).toHaveBeenCalledWith({
      membershipRole: 'OWNER',
      userId: 'user-1',
    });
  });

  it('getStatsEndpoint — returns the stats from the handler', async () => {
    const { controller, getStats } = buildController();
    const result = await controller.getStatsEndpoint('user-1', reqWithRole('OWNER'));
    expect(result).toEqual({
      todayBookings: 5,
      confirmedToday: 3,
      pendingToday: 2,
      pendingPayments: 1,
      cancelRequests: 0,
      todayRevenue: 450.0,
    });
    expect(getStats.execute).toHaveBeenCalled();
  });

  it('getStatsEndpoint — propagates handler errors', async () => {
    const { controller, getStats } = buildController();
    getStats.execute.mockRejectedValue(new Error('DB error'));
    await expect(
      controller.getStatsEndpoint('user-1', reqWithRole('OWNER')),
    ).rejects.toThrow('DB error');
  });
});
