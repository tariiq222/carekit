import { NotFoundException } from '@nestjs/common';
import { PublicBrandingController } from './branding.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

describe('PublicBrandingController', () => {
  it('getBrandingEndpoint — delegates to GetBrandingHandler with tenantId', async () => {
    const getBranding = fn({ primaryColor: '#354FD8' });
    const controller = new PublicBrandingController(getBranding as never);
    const result = await controller.getBrandingEndpoint('tenant-1');
    expect(getBranding.execute).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(result).toMatchObject({ primaryColor: '#354FD8' });
  });

  it('getBrandingEndpoint — bubbles NotFoundException when tenant not found', async () => {
    const getBranding = fn();
    getBranding.execute.mockRejectedValueOnce(new NotFoundException('tenant not found'));
    const controller = new PublicBrandingController(getBranding as never);
    await expect(controller.getBrandingEndpoint('unknown-tenant')).rejects.toThrow(NotFoundException);
  });
});
