import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/guards/jwt.guard';
import { GetBrandingHandler } from '../../modules/org-experience/branding/get-branding.handler';

@Controller('public/branding')
export class PublicBrandingController {
  constructor(private readonly getBranding: GetBrandingHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get(':tenantId')
  getBrandingEndpoint(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.getBranding.execute({ tenantId });
  }
}
