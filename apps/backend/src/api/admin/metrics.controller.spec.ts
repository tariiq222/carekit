import { AdminMetricsController } from './metrics.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const handler = fn({ totalOrgs: 10 });
  const controller = new AdminMetricsController(handler as never);
  return { controller, handler };
}

describe('AdminMetricsController', () => {
  it('platform — calls handler and returns result', async () => {
    const { controller, handler } = buildController();
    const result = await controller.platform();
    expect(handler.execute).toHaveBeenCalled();
    expect(result).toEqual({ totalOrgs: 10 });
  });
});
