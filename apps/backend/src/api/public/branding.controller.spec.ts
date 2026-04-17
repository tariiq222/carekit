import { PublicBrandingController } from './branding.controller';

const mockPublicBranding = {
  organizationNameAr: 'عيادتي',
  organizationNameEn: null,
  productTagline: null,
  logoUrl: null,
  faviconUrl: null,
  colorPrimary: null,
  colorPrimaryLight: null,
  colorPrimaryDark: null,
  colorAccent: null,
  colorAccentDark: null,
  colorBackground: null,
  fontFamily: null,
  fontUrl: null,
  websiteDomain: null,
  activeWebsiteTheme: 'SAWAA' as const,
};

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

describe('PublicBrandingController', () => {
  it('getBrandingEndpoint — delegates to GetPublicBrandingHandler with no args', async () => {
    const getBranding = fn(mockPublicBranding);
    const controller = new PublicBrandingController(getBranding as never);
    const result = await controller.getBrandingEndpoint();
    expect(getBranding.execute).toHaveBeenCalledWith();
    expect(result).toMatchObject({ organizationNameAr: 'عيادتي' });
  });

  it('getBrandingEndpoint — returns PublicBranding shape without internal fields', async () => {
    const getBranding = fn({ ...mockPublicBranding, colorPrimary: '#354FD8' });
    const controller = new PublicBrandingController(getBranding as never);
    const result = await controller.getBrandingEndpoint();
    expect(result.colorPrimary).toBe('#354FD8');
    expect(result).not.toHaveProperty('customCss');
    expect(result).not.toHaveProperty('id');
  });
});
