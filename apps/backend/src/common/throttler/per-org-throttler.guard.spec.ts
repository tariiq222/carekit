import { PerOrgThrottlerGuard } from './per-org-throttler.guard';

describe('PerOrgThrottlerGuard', () => {
  // Test the tracker derivation only — actual rate limiting is integration territory.
  // getTracker is protected; cast to any to access it in unit tests.

  it('uses ip:organizationId as the tracker key', async () => {
    const guard = Object.create(PerOrgThrottlerGuard.prototype) as { getTracker: (req: Record<string, unknown>) => Promise<string> };
    const req = { ip: '1.2.3.4', user: { organizationId: 'org-aaa' } };
    const tracker = await guard.getTracker(req);
    expect(tracker).toBe('1.2.3.4:org-aaa');
  });

  it('falls back to no-tenant when org is unresolved', async () => {
    const guard = Object.create(PerOrgThrottlerGuard.prototype) as { getTracker: (req: Record<string, unknown>) => Promise<string> };
    const req = { ip: '1.2.3.4' };
    const tracker = await guard.getTracker(req);
    expect(tracker).toBe('1.2.3.4:no-tenant');
  });

  it('falls back to unknown when ip is missing', async () => {
    const guard = Object.create(PerOrgThrottlerGuard.prototype) as { getTracker: (req: Record<string, unknown>) => Promise<string> };
    const req = { user: { organizationId: 'org-aaa' } };
    const tracker = await guard.getTracker(req);
    expect(tracker).toBe('unknown:org-aaa');
  });
});
