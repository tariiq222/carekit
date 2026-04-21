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

  const req = (overrides: Partial<{ user: unknown; headers: Record<string, unknown>; hostname: string }> = {}) =>
    ({
      user: undefined,
      headers: {},
      hostname: 'localhost',
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
    await new Promise<void>((done) => {
      cls.run(() =>
        mw.use(
          req({
            user: { id: 'u1', role: 'SUPER_ADMIN', isSuperAdmin: true },
            headers: { 'x-org-id': 'org-header' },
          }),
          {} as never,
          () => {
            expect(ctx.getOrganizationId()).toBe('org-header');
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
});
