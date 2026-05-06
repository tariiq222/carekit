import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { ZohoOAuthService } from './zoho-oauth.service';

/**
 * State-signing isolates one tenant's Connect flow from another's. If state
 * verification ever became permissive (no signature, no expiry, no DC pinning),
 * an attacker could complete an OAuth dance for Tenant B and have the callback
 * write the resulting refresh token onto Tenant A's row.
 */
describe('ZohoOAuthService — state signing', () => {
  function makeService(overrides: Record<string, string> = {}): ZohoOAuthService {
    const env: Record<string, string> = {
      JWT_ACCESS_SECRET: 'test-access-secret-32chars-min',
      ZOHO_OAUTH_CLIENT_ID: 'cid_xxxxxxxxxxxx',
      ZOHO_OAUTH_CLIENT_SECRET: 'csec_xxxxxxxxxxxx',
      ZOHO_OAUTH_REDIRECT_URI: 'http://localhost:5100/dashboard/integrations/zoho/callback',
      ...overrides,
    };
    const cfg = { get: (k: string) => env[k] } as unknown as ConfigService;
    return new ZohoOAuthService(cfg);
  }

  it('builds an authorization URL bound to the chosen DC and a signed state', () => {
    const svc = makeService();
    const { authUrl } = svc.buildAuthorizationUrl({
      organizationId: 'org-A',
      dataCenter: 'sa',
    });
    expect(authUrl).toMatch(/^https:\/\/accounts\.zoho\.sa\/oauth\/v2\/auth\?/);
    expect(authUrl).toContain('scope=ZohoInvoice.fullaccess.all');
    expect(authUrl).toContain('access_type=offline');
    expect(authUrl).toContain('prompt=consent');
    expect(authUrl).toMatch(/[?&]state=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it('round-trips a signed state and recovers the original (orgId, dc)', () => {
    const svc = makeService();
    const { authUrl } = svc.buildAuthorizationUrl({
      organizationId: 'org-A',
      dataCenter: 'eu',
    });
    const state = new URL(authUrl).searchParams.get('state')!;
    const parsed = svc.verifyState(state);
    expect(parsed.organizationId).toBe('org-A');
    expect(parsed.dataCenter).toBe('eu');
  });

  it('REJECTS a state signed by another deployment (different JWT_ACCESS_SECRET)', () => {
    const alice = makeService({ JWT_ACCESS_SECRET: 'alice-secret-32chars-min-padding' });
    const bob = makeService({ JWT_ACCESS_SECRET: 'bob-secret-32chars-min-padding-pad' });
    const { authUrl } = alice.buildAuthorizationUrl({
      organizationId: 'org-A',
      dataCenter: 'sa',
    });
    const state = new URL(authUrl).searchParams.get('state')!;
    expect(() => bob.verifyState(state)).toThrow(UnauthorizedException);
  });

  it('REJECTS tampered state (signature does not match body)', () => {
    const svc = makeService();
    const { authUrl } = svc.buildAuthorizationUrl({
      organizationId: 'org-A',
      dataCenter: 'sa',
    });
    const state = new URL(authUrl).searchParams.get('state')!;
    // Flip the org-A claim in the body half — signature won't match anymore.
    const [body, sig] = state.split('.');
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    decoded.organizationId = 'org-B';
    const tamperedBody = Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64url');
    expect(() => svc.verifyState(`${tamperedBody}.${sig}`)).toThrow(UnauthorizedException);
  });

  it('REJECTS expired state', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const svc = makeService();
      const { authUrl } = svc.buildAuthorizationUrl({
        organizationId: 'org-A',
        dataCenter: 'sa',
      });
      const state = new URL(authUrl).searchParams.get('state')!;
      // 5min TTL + 1ms.
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
      expect(() => svc.verifyState(state)).toThrow(/expired/i);
    } finally {
      jest.useRealTimers();
    }
  });

  it('REJECTS malformed state strings', () => {
    const svc = makeService();
    expect(() => svc.verifyState('')).toThrow(UnauthorizedException);
    expect(() => svc.verifyState('not-a-jwt')).toThrow(UnauthorizedException);
    expect(() => svc.verifyState('a.b')).toThrow(UnauthorizedException);
  });

  it('throws clear errors when env is not configured', () => {
    const svc = makeService({ ZOHO_OAUTH_CLIENT_ID: '' });
    expect(() =>
      svc.buildAuthorizationUrl({ organizationId: 'org-A', dataCenter: 'sa' }),
    ).toThrow('ZOHO_OAUTH_CLIENT_ID');
  });
});

describe('ZohoOAuthService — token cache isolation', () => {
  function makeService(): ZohoOAuthService {
    const cfg = {
      get: (k: string) =>
        ({
          JWT_ACCESS_SECRET: 'test-access-secret-32chars-min',
          ZOHO_OAUTH_CLIENT_ID: 'cid',
          ZOHO_OAUTH_CLIENT_SECRET: 'csec',
          ZOHO_OAUTH_REDIRECT_URI: 'http://localhost/callback',
        }[k] as string | undefined),
    } as unknown as ConfigService;
    return new ZohoOAuthService(cfg);
  }

  it('caches access tokens per (orgId, refreshToken-fingerprint) — never serves Tenant A token to Tenant B', async () => {
    const svc = makeService();
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockImplementation((async (url: string) => {
      const tokenSuffix = url.includes('zoho.sa')
        ? Math.random().toString(36).slice(2)
        : 'fallback';
      return new Response(
        JSON.stringify({ access_token: `at_${tokenSuffix}`, expires_in: 3600 }),
        { status: 200 },
      );
    }) as never);

    try {
      const tokenA = await svc.getAccessToken({
        organizationId: 'org-A',
        refreshToken: 'rt_A',
        dataCenter: 'sa',
      });
      const tokenB = await svc.getAccessToken({
        organizationId: 'org-B',
        refreshToken: 'rt_B',
        dataCenter: 'sa',
      });
      // Different orgs must trigger a fresh fetch — never serve cross-tenant.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(tokenA).not.toEqual(tokenB);

      // Same tenant + same refresh token should hit cache.
      const tokenAAgain = await svc.getAccessToken({
        organizationId: 'org-A',
        refreshToken: 'rt_A',
        dataCenter: 'sa',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(tokenAAgain).toBe(tokenA);

      // Invalidating org A must NOT drop org B's cache.
      svc.invalidateToken('org-A');
      await svc.getAccessToken({
        organizationId: 'org-B',
        refreshToken: 'rt_B',
        dataCenter: 'sa',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2); // still 2 — B was not invalidated
      await svc.getAccessToken({
        organizationId: 'org-A',
        refreshToken: 'rt_A',
        dataCenter: 'sa',
      });
      expect(fetchMock).toHaveBeenCalledTimes(3); // A was forced to refetch
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('treats a refresh-token rotation for the same org as a separate cache slot', async () => {
    const svc = makeService();
    let counter = 0;
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockImplementation((async () => {
      counter++;
      return new Response(
        JSON.stringify({ access_token: `at_${counter}`, expires_in: 3600 }),
        { status: 200 },
      );
    }) as never);

    try {
      await svc.getAccessToken({
        organizationId: 'org-A',
        refreshToken: 'rt_old',
        dataCenter: 'sa',
      });
      await svc.getAccessToken({
        organizationId: 'org-A',
        refreshToken: 'rt_new',
        dataCenter: 'sa',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      fetchMock.mockRestore();
    }
  });
});
