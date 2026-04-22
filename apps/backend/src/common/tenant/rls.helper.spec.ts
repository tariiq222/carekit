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

  it('emits SET LOCAL for both GUC names when org is set', async () => {
    const ctx = { getOrganizationId: () => 'org-abc' } as unknown as TenantContextService;
    const helper = new RlsHelper({} as PrismaService, ctx);
    const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined) };
    await helper.applyInTransaction(tx);
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(1, "SET LOCAL app.current_org_id = 'org-abc'");
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(2, "SET LOCAL app.current_organization_id = 'org-abc'");
  });

  it('escapes single quotes in the id for both GUCs', async () => {
    const ctx = { getOrganizationId: () => "o'rg" } as unknown as TenantContextService;
    const helper = new RlsHelper({} as PrismaService, ctx);
    const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined) };
    await helper.applyInTransaction(tx);
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(1, "SET LOCAL app.current_org_id = 'o''rg'");
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(2, "SET LOCAL app.current_organization_id = 'o''rg'");
  });
});
