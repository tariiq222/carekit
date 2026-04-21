import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import { ConfigModule } from '@nestjs/config';
import { TenantContextService } from './tenant-context.service';
import { buildTenantScopingExtension } from './tenant-scoping.extension';

describe('tenant-scoping extension', () => {
  let cls: ClsService;
  let ctx: TenantContextService;

  const buildCtx = async (enforcement: string) => {
    const mod = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ TENANT_ENFORCEMENT: enforcement })],
        }),
      ],
      providers: [TenantContextService],
    }).compile();
    cls = mod.get(ClsService);
    ctx = mod.get(TenantContextService);
  };

  it('returns a no-op extension shape when TENANT_ENFORCEMENT=off', async () => {
    await buildCtx('off');
    const ext = buildTenantScopingExtension(ctx, 'off', new Set());
    expect(ext.query).toBeUndefined();
    expect(ext.name).toBe('tenant-scoping:dormant');
  });

  it('registers a query hook when TENANT_ENFORCEMENT!=off', async () => {
    await buildCtx('permissive');
    const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['User']));
    expect(ext.query?.$allModels.$allOperations).toBeDefined();
  });

  it('scopes findMany by injecting organizationId when model is registered', async () => {
    await buildCtx('permissive');
    const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['User']));
    const hook = ext.query!.$allModels.$allOperations!;

    await new Promise<void>((done) => {
      cls.run(async () => {
        ctx.set({
          organizationId: 'org-1',
          membershipId: 'm1',
          id: 'u1',
          role: 'ADMIN',
          isSuperAdmin: false,
        });
        const query = jest.fn().mockResolvedValue([]);
        await hook({ model: 'User', operation: 'findMany', args: { where: { id: 'x' } }, query } as never);
        expect(query).toHaveBeenCalledWith({ where: { id: 'x', organizationId: 'org-1' } });
        done();
      });
    });
  });

  it('does not scope unregistered models', async () => {
    await buildCtx('permissive');
    const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['User']));
    const hook = ext.query!.$allModels.$allOperations!;

    await new Promise<void>((done) => {
      cls.run(async () => {
        ctx.set({
          organizationId: 'org-1',
          membershipId: 'm1',
          id: 'u1',
          role: 'ADMIN',
          isSuperAdmin: false,
        });
        const query = jest.fn().mockResolvedValue([]);
        await hook({ model: 'OtpCode', operation: 'findMany', args: { where: {} }, query } as never);
        expect(query).toHaveBeenCalledWith({ where: {} });
        done();
      });
    });
  });

  it('bypasses scoping for super-admin context', async () => {
    await buildCtx('permissive');
    const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['User']));
    const hook = ext.query!.$allModels.$allOperations!;

    await new Promise<void>((done) => {
      cls.run(async () => {
        ctx.set({
          organizationId: 'org-1',
          membershipId: 'm1',
          id: 'u1',
          role: 'SUPER_ADMIN',
          isSuperAdmin: true,
        });
        const query = jest.fn().mockResolvedValue([]);
        await hook({ model: 'User', operation: 'findMany', args: { where: {} }, query } as never);
        expect(query).toHaveBeenCalledWith({ where: {} });
        done();
      });
    });
  });

  it('does not scope when tenant context is missing (system jobs)', async () => {
    await buildCtx('permissive');
    const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['User']));
    const hook = ext.query!.$allModels.$allOperations!;

    await new Promise<void>((done) => {
      cls.run(async () => {
        // intentionally no ctx.set()
        const query = jest.fn().mockResolvedValue([]);
        await hook({ model: 'User', operation: 'findMany', args: { where: {} }, query } as never);
        expect(query).toHaveBeenCalledWith({ where: {} });
        done();
      });
    });
  });

  it('skips mutation ops that are not in SCOPED_OPERATIONS', async () => {
    await buildCtx('permissive');
    const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['User']));
    const hook = ext.query!.$allModels.$allOperations!;

    await new Promise<void>((done) => {
      cls.run(async () => {
        ctx.set({
          organizationId: 'org-1',
          membershipId: 'm1',
          id: 'u1',
          role: 'ADMIN',
          isSuperAdmin: false,
        });
        const query = jest.fn().mockResolvedValue({});
        await hook({ model: 'User', operation: 'create', args: { data: {} }, query } as never);
        // `create` is not in SCOPED_OPERATIONS, so args pass through untouched.
        expect(query).toHaveBeenCalledWith({ data: {} });
        done();
      });
    });
  });
});
