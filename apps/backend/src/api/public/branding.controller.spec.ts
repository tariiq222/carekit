import { PublicBrandingController } from './branding.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

describe('PublicBrandingController', () => {
  it('getBrandingEndpoint — delegates to GetBrandingHandler with no args', async () => {
    const getBranding = fn({ colorPrimary: '#354FD8' });
    const controller = new PublicBrandingController(getBranding as never);
    const result = await controller.getBrandingEndpoint();
    expect(getBranding.execute).toHaveBeenCalledWith();
    expect(result).toMatchObject({ colorPrimary: '#354FD8' });
  });

  it('getBrandingEndpoint — returns the branding config', async () => {
    const getBranding = fn({ colorPrimary: '#354FD8', organizationNameAr: 'عيادتي' });
    const controller = new PublicBrandingController(getBranding as never);
    const result = await controller.getBrandingEndpoint();
    expect(result.colorPrimary).toBe('#354FD8');
  });
});