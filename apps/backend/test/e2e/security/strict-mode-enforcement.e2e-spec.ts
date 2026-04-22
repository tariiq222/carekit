/**
 * SaaS-02h — strict mode enforcement contract.
 *
 * Proves that `TenantContextService.requireOrganizationId()` fails closed
 * (throws `UnauthorizedTenantAccessError`) when CLS has no org. This is the
 * invariant handlers depend on under strict default — if it ever regresses
 * to a silent DEFAULT_ORG fallback, everything leaks to the seed tenant.
 *
 * Also verifies that inside a `cls.run` with an org set, the helper returns
 * it and DOES NOT throw.
 */
import { UnauthorizedException } from '@nestjs/common';
import { bootSecurityHarness, SecurityHarness } from './harness';
import { UnauthorizedTenantAccessError } from '../../../src/common/tenant/tenant.errors';

describe('SaaS-02h — strict mode enforcement', () => {
  let h: SecurityHarness;

  beforeAll(async () => {
    h = await bootSecurityHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('requireOrganizationId throws UnauthorizedTenantAccessError outside any cls.run', () => {
    expect(() => h.ctx.requireOrganizationId()).toThrow(UnauthorizedTenantAccessError);
    expect(() => h.ctx.requireOrganizationId()).toThrow(UnauthorizedException);
  });

  it('requireOrganizationId throws inside cls.run when no org is set', async () => {
    await h.cls.run(async () => {
      expect(() => h.ctx.requireOrganizationId()).toThrow(UnauthorizedTenantAccessError);
    });
  });

  it('requireOrganizationId returns the id inside cls.run with org set', async () => {
    const { orgA } = await h.seedTwoOrgs('strict-returns');
    await h.withCls(orgA.id, async () => {
      expect(h.ctx.requireOrganizationId()).toBe(orgA.id);
    });
  });

  it('requireOrganizationIdOrDefault still falls back when CLS unset (system-entry only)', () => {
    // OrDefault is the escape hatch for seeds/cron/webhooks — it NEVER throws.
    // The penetration contract is that handlers for authenticated routes use
    // requireOrganizationId(), not the OrDefault variant.
    const id = h.ctx.requireOrganizationIdOrDefault();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});
