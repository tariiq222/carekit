import { ConfigService } from '@nestjs/config';
import { LaunchFlags } from './launch-flags';

const make = (env: Record<string, string | undefined>) => {
  const cfg = { get: jest.fn((k: string) => env[k]) } as unknown as ConfigService;
  return new LaunchFlags(cfg);
};

describe('LaunchFlags', () => {
  it('planVersioningEnabled defaults to false when env unset', () => {
    expect(make({}).planVersioningEnabled).toBe(false);
  });

  it('planVersioningEnabled is true when env=true', () => {
    expect(make({ PLAN_VERSIONING_ENABLED: 'true' }).planVersioningEnabled).toBe(true);
  });

  it('trialAutoChargeEnabled defaults false', () => {
    expect(make({}).trialAutoChargeEnabled).toBe(false);
  });

  it('couponStrictEnabled defaults false', () => {
    expect(make({}).couponStrictEnabled).toBe(false);
  });

  it('bookingExpiryEnabled defaults false', () => {
    expect(make({}).bookingExpiryEnabled).toBe(false);
  });
});
