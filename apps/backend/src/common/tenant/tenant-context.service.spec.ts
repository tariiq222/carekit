import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import { TenantContextService, TenantContext } from './tenant-context.service';
import { DEFAULT_ORGANIZATION_ID } from './tenant.constants';

describe('TenantContextService', () => {
  let cls: ClsService;
  let svc: TenantContextService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true, middleware: { mount: false } })],
      providers: [TenantContextService],
    }).compile();

    cls = mod.get(ClsService);
    svc = mod.get(TenantContextService);
  });

  const ctx: TenantContext = {
    organizationId: 'org-1',
    membershipId: 'mem-1',
    id: 'user-1',
    role: 'ADMIN',
    isSuperAdmin: false,
  };

  it('returns undefined when context is not set', () => {
    cls.run(() => {
      expect(svc.get()).toBeUndefined();
      expect(svc.getOrganizationId()).toBeUndefined();
    });
  });

  it('stores and reads context within a CLS run', () => {
    cls.run(() => {
      svc.set(ctx);
      expect(svc.get()).toEqual(ctx);
      expect(svc.getOrganizationId()).toBe('org-1');
      expect(svc.getMembershipId()).toBe('mem-1');
    });
  });

  it('isolates context per run', async () => {
    await Promise.all([
      cls.run(async () => {
        svc.set({ ...ctx, organizationId: 'org-A' });
        await new Promise((r) => setTimeout(r, 10));
        expect(svc.getOrganizationId()).toBe('org-A');
      }),
      cls.run(async () => {
        svc.set({ ...ctx, organizationId: 'org-B' });
        await new Promise((r) => setTimeout(r, 10));
        expect(svc.getOrganizationId()).toBe('org-B');
      }),
    ]);
  });

  it('requireOrganizationId throws when missing', () => {
    cls.run(() => {
      expect(() => svc.requireOrganizationId()).toThrow(/tenant context not set/i);
    });
  });

  it('requireOrganizationId returns the id when set', () => {
    cls.run(() => {
      svc.set(ctx);
      expect(svc.requireOrganizationId()).toBe('org-1');
    });
  });

  it('requireOrganizationIdOrDefault falls back to DEFAULT_ORGANIZATION_ID when no context', () => {
    cls.run(() => {
      expect(svc.requireOrganizationIdOrDefault()).toBe(DEFAULT_ORGANIZATION_ID);
    });
  });

  it('requireOrganizationIdOrDefault returns the current org when set', () => {
    cls.run(() => {
      svc.set(ctx);
      expect(svc.requireOrganizationIdOrDefault()).toBe('org-1');
    });
  });
});
