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

describe('DashboardStatsController', () => {
  it('getStatsEndpoint — delegates to handler with no args', async () => {
    const { controller, getStats } = buildController();
    await controller.getStatsEndpoint();
    expect(getStats.execute).toHaveBeenCalledWith();
  });

  it('getStatsEndpoint — returns the stats from the handler', async () => {
    const { controller, getStats } = buildController();
    const result = await controller.getStatsEndpoint();
    expect(result).toEqual({
      todayBookings: 5,
      confirmedToday: 3,
      pendingToday: 2,
      pendingPayments: 1,
      cancelRequests: 0,
      todayRevenue: 450.0,
    });
  });

  it('getStatsEndpoint — propagates handler errors', async () => {
    const { controller, getStats } = buildController();
    getStats.execute.mockRejectedValue(new Error('DB error'));
    await expect(controller.getStatsEndpoint()).rejects.toThrow('DB error');
  });
});
