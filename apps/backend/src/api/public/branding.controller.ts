import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { GetBrandingHandler } from '../../modules/org-experience/branding/get-branding.handler';

@ApiTags('Public / Branding')
@ApiPublicResponses()
@Controller('public/branding')
export class PublicBrandingController {
  constructor(private readonly getBranding: GetBrandingHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  @ApiOperation({ summary: 'Get clinic branding (public)' })
  @ApiOkResponse({ description: 'Clinic branding config' })
  getBrandingEndpoint() {
    return this.getBranding.execute();
  }
}