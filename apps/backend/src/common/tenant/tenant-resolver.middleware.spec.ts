import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import { ConfigModule } from '@nestjs/config';
import { TenantContextService } from './tenant-context.service';
import { TenantResolverMiddleware } from './tenant-resolver.middleware';
import { TenantResolutionError } from './tenant.errors';
import { DEFAULT_ORGANIZATION_ID } from './tenant.constants';

describe('TenantResolverMiddleware', () => {
  let cls: ClsService;
  let ctx: TenantContextService;

  const build = async (envOverrides: Record<string, string> = {}) => {
    const mod = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ TENANT_ENFORCEMENT: 'off', DEFAULT_ORGANIZATION_ID, ...envOverrides })],
        }),
      ],
      providers: [TenantContextService, TenantResolverMiddleware],
    }).compile();
    cls = mod.get(ClsService);
    ctx = mod.get(TenantContextService);
    return mod.get(TenantResolverMiddleware);
  };

  const req = (
    overrides: Partial<{
      user: unknown;
      headers: Record<string, unknown>;
      hostname: string;
      path: string;
      url: string;
    }> = {},
  ) =>
    ({
      user: undefined,
      headers: {},
      hostname: 'localhost',
      path: '/api/v1/dashboard/bookings',
      url: '/api/v1/dashboard/bookings',
      ...overrides,
    }) as never;

  it('off mode: does not set context, does not throw when unresolved', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'off' });
    await new Promise<void>((done) => {
      cls.run(() =>
        mw.use(req(), {} as never, () => {
          expect(ctx.get()).toBeUndefined();
          done();
        }),
      );
    });
  });

  it('permissive mode: falls back to default org when unresolved', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'permissive' });
    await new Promise<void>((done) => {
      cls.run(() =>
        mw.use(req(), {} as never, () => {
          expect(ctx.getOrganizationId()).toBe(DEFAULT_ORGANIZATION_ID);
          done();
        }),
      );
    });
  });

  it('permissive mode: prefers JWT claim over default', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'permissive' });
    await new Promise<void>((done) => {
      cls.run(() =>
        mw.use(
          req({ user: { id: 'u1', organizationId: 'org-jwt', membershipId: 'm1', role: 'ADMIN' } }),
          {} as never,
          () => {
            expect(ctx.getOrganizationId()).toBe('org-jwt');
            done();
          },
        ),
      );
    });
  });

  it('strict mode: throws when no source resolves an org', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
    expect(() => cls.run(() => mw.use(req(), {} as never, () => undefined))).toThrow(
      TenantResolutionError,
    );
  });

  it('strict mode: accepts explicit header when super-admin', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
    const headerOrg = '550e8400-e29b-41d4-a716-446655440000';
    await new Promise<void>((done) => {
      cls.run(() =>
        mw.use(
          req({
            user: { id: 'u1', role: 'SUPER_ADMIN', isSuperAdmin: true },
            headers: { 'x-org-id': headerOrg },
          }),
          {} as never,
          () => {
            expect(ctx.getOrganizationId()).toBe(headerOrg);
            done();
          },
        ),
      );
    });
  });

  it('strict mode: ignores x-org-id from non-super-admin (security)', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
    await new Promise<void>((done) => {
      cls.run(() =>
        mw.use(
          req({
            user: { id: 'u1', organizationId: 'org-jwt', role: 'ADMIN' },
            headers: { 'x-org-id': 'org-attacker' },
          }),
          {} as never,
          () => {
            expect(ctx.getOrganizationId()).toBe('org-jwt'); // JWT wins
            done();
          },
        ),
      );
    });
  });

  describe('isPublicRoute()', () => {
    let mw: TenantResolverMiddleware;
    beforeEach(async () => {
      mw = await build({ TENANT_ENFORCEMENT: 'permissive' });
    });

    it('accepts /api/v1/public/* paths', () => {
      expect((mw as unknown as { isPublicRoute(p: string): boolean }).isPublicRoute('/api/v1/public/services/departments')).toBe(true);
    });

    it('rejects authenticated paths', () => {
      expect((mw as unknown as { isPublicRoute(p: string): boolean }).isPublicRoute('/api/v1/dashboard/bookings')).toBe(false);
    });

    it('rejects /api/v1/public/sms/webhooks/* (webhooks self-resolve)', () => {
      expect((mw as unknown as { isPublicRoute(p: string): boolean }).isPublicRoute('/api/v1/public/sms/webhooks/unifonic/org-1')).toBe(false);
    });
  });

  describe('parseUuidHeader()', () => {
    let mw: TenantResolverMiddleware;
    beforeEach(async () => {
      mw = await build({ TENANT_ENFORCEMENT: 'permissive' });
    });

    const parse = (v: unknown) =>
      (mw as unknown as { parseUuidHeader(v: unknown): string | undefined }).parseUuidHeader(v);

    it('accepts well-formed UUID', () => {
      expect(parse('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('accepts the all-zero DEFAULT_ORGANIZATION_ID', () => {
      expect(parse('00000000-0000-0000-0000-000000000001')).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('rejects non-string values', () => {
      expect(parse(undefined)).toBeUndefined();
      expect(parse(123)).toBeUndefined();
      expect(parse(null)).toBeUndefined();
    });

    it('rejects malformed UUIDs', () => {
      expect(parse('not-a-uuid')).toBeUndefined();
      expect(parse('550e8400-e29b-41d4-a716')).toBeUndefined();
      expect(parse('550e8400e29b41d4a716446655440000')).toBeUndefined();
    });

    it('trims whitespace', () => {
      expect(parse('  550e8400-e29b-41d4-a716-446655440000  ')).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });
});
