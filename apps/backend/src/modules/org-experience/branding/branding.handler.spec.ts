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
    findUnique: jest.fn().mockResolvedValue(mockConfig),
    create: jest.fn().mockResolvedValue(mockConfig),
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
  it('returns the org-scoped row via findUnique when it exists', async () => {
    const prisma = buildPrisma();
    const handler = new GetBrandingHandler(prisma as never, buildTenant());
    await handler.execute();
    expect(prisma.brandingConfig.findUnique).toHaveBeenCalledWith({
      where: { organizationId: DEFAULT_ORG },
    });
    expect(prisma.brandingConfig.create).not.toHaveBeenCalled();
  });

  it('creates a default row only when none exists', async () => {
    const prisma = {
      brandingConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockConfig),
      },
    };
    const handler = new GetBrandingHandler(prisma as never, buildTenant());
    await handler.execute();
    expect(prisma.brandingConfig.create).toHaveBeenCalledWith({
      data: { organizationId: DEFAULT_ORG, organizationNameAr: 'منظمتي' },
    });
  });
});

describe('UpsertBrandingHandler — security validations', () => {
  beforeEach(() => {
    process.env.BRANDING_ALLOWED_ASSET_HOSTS = 'cdn.example.com';
  });
  afterEach(() => {
    delete process.env.BRANDING_ALLOWED_ASSET_HOSTS;
  });

  it('rejects logoUrl from non-allowed host', async () => {
    const handler = new UpsertBrandingHandler(buildPrisma() as never, buildTenant());
    await expect(
      handler.execute({ organizationNameAr: 'X', logoUrl: 'https://attacker.com/logo.png' }),
    ).rejects.toThrow(/logoUrl/);
  });

  it('rejects fontUrl from non-allowed host', async () => {
    const handler = new UpsertBrandingHandler(buildPrisma() as never, buildTenant());
    await expect(
      handler.execute({ organizationNameAr: 'X', fontUrl: 'https://evil.com/f.css' }),
    ).rejects.toThrow(/fontUrl/);
  });

  it('rejects customCss containing @import', async () => {
    const handler = new UpsertBrandingHandler(buildPrisma() as never, buildTenant());
    await expect(
      handler.execute({ organizationNameAr: 'X', customCss: '@import url(https://cdn.example.com/x.css);' }),
    ).rejects.toThrow(/customCss/);
  });

  it('rejects customCss containing <script>', async () => {
    const handler = new UpsertBrandingHandler(buildPrisma() as never, buildTenant());
    await expect(
      handler.execute({ organizationNameAr: 'X', customCss: '</style><script>alert(1)</script>' }),
    ).rejects.toThrow(/customCss/);
  });

  it('accepts logoUrl from allowed host', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertBrandingHandler(prisma as never, buildTenant());
    await expect(
      handler.execute({ organizationNameAr: 'X', logoUrl: 'https://cdn.example.com/logo.png' }),
    ).resolves.toBeDefined();
  });
});
