import { UpsertBrandingHandler } from './upsert-branding.handler';
import { GetBrandingHandler } from './get-branding.handler';
import { TenantContextService } from '../../../common/tenant';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const mockConfig = {
  id: 'some-uuid',
  organizationId: DEFAULT_ORG,
  organizationNameAr: 'عيادتي',
  organizationNameEn: 'My Clinic',
  productTagline: null,
  logoUrl: null,
  faviconUrl: null,
  colorPrimary: '#354FD8',
  colorPrimaryLight: null,
  colorPrimaryDark: null,
  colorAccent: null,
  colorAccentDark: null,
  colorBackground: null,
  fontFamily: null,
  fontUrl: null,
  customCss: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPrisma = () => ({
  brandingConfig: {
    upsert: jest.fn().mockResolvedValue(mockConfig),
  },
});

const buildTenant = (organizationId = DEFAULT_ORG) =>
  ({
    requireOrganizationId: jest.fn().mockReturnValue(organizationId),
    requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
  }) as unknown as TenantContextService;

describe('UpsertBrandingHandler', () => {
  it('upserts branding config scoped by organizationId', async () => {
    const prisma = buildPrisma();
    const tenant = buildTenant();
    const handler = new UpsertBrandingHandler(prisma as never, tenant);
    await handler.execute({ organizationNameAr: 'عيادتي' });
    expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith({
      where: { organizationId: DEFAULT_ORG },
      create: expect.objectContaining({ organizationId: DEFAULT_ORG, organizationNameAr: 'عيادتي' }),
      update: { organizationNameAr: 'عيادتي' },
    });
  });

  it('two orgs can have different branding simultaneously', async () => {
    const prismaA = buildPrisma();
    const prismaB = buildPrisma();
    const handlerA = new UpsertBrandingHandler(prismaA as never, buildTenant('org-A'));
    const handlerB = new UpsertBrandingHandler(prismaB as never, buildTenant('org-B'));
    await handlerA.execute({ organizationNameAr: 'عيادة أ' });
    await handlerB.execute({ organizationNameAr: 'عيادة ب' });
    expect(prismaA.brandingConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-A' } }),
    );
    expect(prismaB.brandingConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-B' } }),
    );
  });
});

describe('GetBrandingHandler', () => {
  it('returns the org-scoped row via upsert-on-read', async () => {
    const prisma = buildPrisma();
    const handler = new GetBrandingHandler(prisma as never, buildTenant());
    await handler.execute();
    expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith({
      where: { organizationId: DEFAULT_ORG },
      create: expect.objectContaining({ organizationId: DEFAULT_ORG }),
      update: {},
    });
  });
});
