import { DashboardIntegrationsController } from './integrations.controller';
import { REQUIRE_FEATURE_KEY } from '../../modules/platform/billing/feature.decorator';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const getZoomConfig = fn({ configured: false, active: false });
  const upsertZoomConfig = fn({ configured: true, active: true });
  const testZoomConfig = fn({ ok: true });
  const controller = new DashboardIntegrationsController(
    getZoomConfig as never,
    upsertZoomConfig as never,
    testZoomConfig as never,
  );
  return { controller, getZoomConfig, upsertZoomConfig, testZoomConfig };
}

describe('DashboardIntegrationsController', () => {
  it('getZoom — returns zoom config', async () => {
    const { controller, getZoomConfig } = buildController();
    await controller.getZoom();
    expect(getZoomConfig.execute).toHaveBeenCalled();
  });

  it('upsertZoom — passes body', async () => {
    const { controller, upsertZoomConfig } = buildController();
    await controller.upsertZoom({ accountId: 'acc-1', clientId: 'cid-1', clientSecret: 'sec-1' } as never);
    expect(upsertZoomConfig.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc-1' }),
    );
  });

  it('testZoom — passes body', async () => {
    const { controller, testZoomConfig } = buildController();
    await controller.testZoom({ accountId: 'acc-1', clientId: 'cid-1', clientSecret: 'sec-1' } as never);
    expect(testZoomConfig.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc-1' }),
    );
  });
});

describe('@RequireFeature metadata — ZOOM_INTEGRATION', () => {
  it.each([
    'getZoom',
    'upsertZoom',
    'testZoom',
  ])('annotates %s with FeatureKey.ZOOM_INTEGRATION', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (DashboardIntegrationsController.prototype as unknown as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.ZOOM_INTEGRATION);
  });
});
