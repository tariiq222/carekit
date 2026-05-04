import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { FeatureCheckService } from './feature-check.service';

describe('FeatureCheckService', () => {
  const buildCache = (limits: Record<string, unknown> | null) => ({
    get: jest.fn().mockResolvedValue(limits === null ? null : { limits }),
  });

  it('returns true for enabled boolean feature', async () => {
    const svc = new FeatureCheckService(buildCache({ coupons: true }) as never);
    expect(await svc.isEnabled('org-1', FeatureKey.COUPONS)).toBe(true);
  });

  it('returns false for disabled boolean feature', async () => {
    const svc = new FeatureCheckService(buildCache({ coupons: false }) as never);
    expect(await svc.isEnabled('org-1', FeatureKey.COUPONS)).toBe(false);
  });

  it('returns false when no subscription exists', async () => {
    const svc = new FeatureCheckService(buildCache(null) as never);
    expect(await svc.isEnabled('org-1', FeatureKey.COUPONS)).toBe(false);
  });

  it('returns true for non-zero numeric limit', async () => {
    const svc = new FeatureCheckService(buildCache({ maxBranches: 5 }) as never);
    expect(await svc.isEnabled('org-1', FeatureKey.BRANCHES)).toBe(true);
  });

  it('returns false for missing key', async () => {
    const svc = new FeatureCheckService(buildCache({}) as never);
    expect(await svc.isEnabled('org-1', FeatureKey.COUPONS)).toBe(false);
  });
});
