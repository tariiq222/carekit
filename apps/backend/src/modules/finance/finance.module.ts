import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { StorageModule } from '../../infrastructure/storage';
import { CreateInvoiceHandler } from './create-invoice/create-invoice.handler';
import { BookingConfirmedHandler } from './create-invoice/booking-confirmed.handler';
import { ProcessPaymentHandler } from './process-payment/process-payment.handler';
import { MoyasarWebhookHandler } from './moyasar-webhook/moyasar-webhook.handler';
import { BankTransferUploadHandler } from './bank-transfer-upload/bank-transfer-upload.handler';
import { ApplyCouponHandler } from './apply-coupon/apply-coupon.handler';
import { RedeemGiftCardHandler } from './redeem-gift-card/redeem-gift-card.handler';
import { ZatcaSubmitHandler } from './zatca-submit/zatca-submit.handler';
import { GetInvoiceHandler } from './get-invoice/get-invoice.handler';
import { ListPaymentsHandler } from './list-payments/list-payments.handler';

const handlers = [
  CreateInvoiceHandler,
  ProcessPaymentHandler,
  MoyasarWebhookHandler,
  BankTransferUploadHandler,
  ApplyCouponHandler,
  RedeemGiftCardHandler,
  ZatcaSubmitHandler,
  GetInvoiceHandler,
  ListPaymentsHandler,
];

@Module({
  imports: [DatabaseModule, MessagingModule, StorageModule],
  providers: [...handlers, BookingConfirmedHandler],
  exports: [...handlers],
})
export class FinanceModule implements OnModuleInit {
  constructor(private readonly bookingConfirmedHandler: BookingConfirmedHandler) {}

  onModuleInit(): void {
    this.bookingConfirmedHandler.register();
  }
}
