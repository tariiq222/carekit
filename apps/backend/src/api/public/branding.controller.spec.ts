import { NotFoundException } from '@nestjs/common';
import { PublicBrandingController } from './branding.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

describe('PublicBrandingController', () => {
  it('getBrandingEndpoint — delegates to GetBrandingHandler with no args', async () => {
    const getBranding = fn({ primaryColor: '#354FD8' });
    const controller = new PublicBrandingController(getBranding as never);
    const result = await controller.getBrandingEndpoint();
    expect(getBranding.execute).toHaveBeenCalledWith();
    expect(result).toMatchObject({ primaryColor: '#354FD8' });
  });

  it('getBrandingEndpoint — returns the branding config', async () => {
    const getBranding = fn({ primaryColor: '#354FD8', clinicNameAr: 'عيادتي' });
    const controller = new PublicBrandingController(getBranding as never);
    const result = await controller.getBrandingEndpoint();
    expect(result.primaryColor).toBe('#354FD8');
  });
});