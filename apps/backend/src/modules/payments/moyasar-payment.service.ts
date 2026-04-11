import { Injectable } from '@nestjs/common';
import { MoyasarCheckoutService } from './moyasar-checkout.service.js';
import { MoyasarWebhookService } from './moyasar-webhook.service.js';
import { MoyasarRefundService } from './moyasar-refund.service.js';
import { CreateMoyasarPaymentDto } from './dto/create-moyasar-payment.dto.js';
import { MoyasarWebhookDto } from './dto/moyasar-webhook.dto.js';

/**
 * Orchestrator — delegates to focused Moyasar services.
 * Keeps the public API surface unchanged for PaymentsController.
 */
@Injectable()
export class MoyasarPaymentService {
  constructor(
    private readonly checkoutService: MoyasarCheckoutService,
    private readonly webhookService: MoyasarWebhookService,
    private readonly refundService: MoyasarRefundService,
  ) {}

  async createMoyasarPayment(userId: string, dto: CreateMoyasarPaymentDto) {
    return this.checkoutService.createMoyasarPayment(userId, dto);
  }

  async handleMoyasarWebhook(
    signature: string,
    rawBody: Buffer,
    dto: MoyasarWebhookDto,
  ) {
    return this.webhookService.handleMoyasarWebhook(signature, rawBody, dto);
  }

  async refund(paymentId: string, amount?: number) {
    return this.refundService.refund(paymentId, amount);
  }
}
