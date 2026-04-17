import { UpsertBrandingHandler } from './upsert-branding.handler';
import { GetBrandingHandler } from './get-branding.handler';

const mockConfig = {
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
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPrisma = () => ({
  brandingConfig: {
    upsert: jest.fn().mockResolvedValue(mockConfig),
  },
});

describe('UpsertBrandingHandler', () => {
  it('upserts branding config with singleton id', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertBrandingHandler(prisma as never);
    const result = await handler.execute({ organizationNameAr: 'عيادتي' });
    expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: expect.objectContaining({ id: 'default', organizationNameAr: 'عيادتي' }),
      update: { organizationNameAr: 'عيادتي' },
    });
    expect(result.id).toBe('default');
  });
});

describe('GetBrandingHandler', () => {
  it('returns the singleton row, creating it on first call', async () => {
    const prisma = buildPrisma();
    const handler = new GetBrandingHandler(prisma as never);
    const result = await handler.execute();
    expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: expect.objectContaining({ id: 'default' }),
      update: {},
    });
    expect(result.id).toBe('default');
  });
});
