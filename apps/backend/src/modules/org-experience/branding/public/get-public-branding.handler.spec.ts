import { GetPublicBrandingHandler } from './get-public-branding.handler';

const mockRow = {
  id: 'default',
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
  websiteDomain: null,
  activeWebsiteTheme: 'SAWAA' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPrisma = () => ({
  brandingConfig: {
    upsert: jest.fn().mockResolvedValue(mockRow),
  },
});

describe('GetPublicBrandingHandler', () => {
  it('maps the Prisma row to PublicBranding shape', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicBrandingHandler(prisma as never);

    const result = await handler.execute();

    expect(result).toEqual({
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
      websiteDomain: null,
      activeWebsiteTheme: 'SAWAA',
    });
    expect(result).not.toHaveProperty('customCss');
    expect(result).not.toHaveProperty('id');
  });

  it('creates a default row on first call', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicBrandingHandler(prisma as never);

    await handler.execute();

    expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: { id: 'default', organizationNameAr: 'منظمتي' },
      update: {},
    });
  });
});
