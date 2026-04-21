import { RlsHelper } from './rls.helper';
import { TenantContextService } from './tenant-context.service';
import type { PrismaService } from '../../infrastructure/database/prisma.service';

describe('RlsHelper', () => {
  it('no-ops when tenant context is unset', async () => {
    const ctx = { getOrganizationId: () => undefined } as unknown as TenantContextService;
    const helper = new RlsHelper({} as PrismaService, ctx);
    const tx = { $executeRawUnsafe: jest.fn() };
    await helper.applyInTransaction(tx);
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('emits SET LOCAL when org is set', async () => {
    const ctx = { getOrganizationId: () => 'org-abc' } as unknown as TenantContextService;
    const helper = new RlsHelper({} as PrismaService, ctx);
    const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined) };
    await helper.applyInTransaction(tx);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith("SET LOCAL app.current_org_id = 'org-abc'");
  });

  it('escapes single quotes in the id', async () => {
    const ctx = { getOrganizationId: () => "o'rg" } as unknown as TenantContextService;
    const helper = new RlsHelper({} as PrismaService, ctx);
    const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined) };
    await helper.applyInTransaction(tx);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith("SET LOCAL app.current_org_id = 'o''rg'");
  });
});
