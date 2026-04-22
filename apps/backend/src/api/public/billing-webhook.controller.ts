import { Controller, Headers, HttpCode, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { MoyasarSubscriptionWebhookHandler } from '../../modules/finance/moyasar-api/moyasar-subscription-webhook.handler';

@ApiTags('Public / Billing')
@Controller('public/billing/webhooks/moyasar')
export class BillingWebhookController {
  constructor(private readonly handler: MoyasarSubscriptionWebhookHandler) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Moyasar subscription payment webhook' })
  handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-moyasar-signature') signature: string,
  ) {
    return this.handler.execute(req.rawBody!, signature);
  }
}
