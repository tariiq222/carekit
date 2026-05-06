import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/guards/jwt.guard';
import { HandleZohoWebhookHandler } from '../../modules/integrations/zoho-invoice/webhooks/handle-event.handler';

/**
 * Public endpoint Zoho posts to. The path token is the tenant's Deqah
 * organizationId for tenant→client mirror events, or the literal
 * `platform` for events on Deqah's own SaaS-billing Zoho org.
 *
 * The endpoint is signature-verified with a per-tenant secret (see
 * `ZohoWebhookVerifier`); it never trusts the path alone.
 */
@ApiTags('Public / Zoho')
@Controller('public/webhooks/zoho')
export class PublicZohoWebhookController {
  constructor(private readonly handler: HandleZohoWebhookHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post(':tenantToken')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive Zoho Invoice webhook events (mirror-only)' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { received: { type: 'boolean' } } },
  })
  async handle(
    @Param('tenantToken') tenantToken: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-zoho-webhook-signature') signature: string | undefined,
    @Body() payload: Record<string, unknown>,
  ) {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }
    return this.handler.execute({
      tenantToken,
      rawBody,
      signature,
      payload,
    });
  }
}
