import { UpsertBrandingHandler } from './upsert-branding.handler';
import { GetBrandingHandler } from './get-branding.handler';

const mockConfig = {
  id: 'cfg-1',
  tenantId: 'tenant-1',
  clinicNameAr: 'عيادتي',
  clinicNameEn: 'My Clinic',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#354FD8',
  accentColor: null,
  fontFamily: null,
  customCss: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPrisma = () => ({
  brandingConfig: {
    upsert: jest.fn().mockResolvedValue(mockConfig),
    findUnique: jest.fn().mockResolvedValue(mockConfig),
  },
});

describe('UpsertBrandingHandler', () => {
  it('creates branding config', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertBrandingHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', clinicNameAr: 'عيادتي' });
    expect(result.tenantId).toBe('tenant-1');
    expect(prisma.brandingConfig.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('GetBrandingHandler', () => {
  it('returns branding config', async () => {
    const prisma = buildPrisma();
    const handler = new GetBrandingHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1' });
    expect(result.clinicNameAr).toBe('عيادتي');
  });

  it('returns defaults when config not found', async () => {
    const prisma = buildPrisma();
    prisma.brandingConfig.findUnique = jest.fn().mockResolvedValue(null);
    const handler = new GetBrandingHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'missing' });
    expect(result.tenantId).toBe('missing');
    expect(result.clinicNameAr).toBe('');
    expect(result.primaryColor).toBeNull();
  });
});
