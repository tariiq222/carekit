import { Module, OnModuleInit } from '@nestjs/common';
import { DashboardFinanceController } from '../../api/dashboard/finance.controller';
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
import { ListCouponsHandler } from './coupons/list-coupons.handler';
import { GetCouponHandler } from './coupons/get-coupon.handler';
import { CreateCouponHandler } from './coupons/create-coupon.handler';
import { UpdateCouponHandler } from './coupons/update-coupon.handler';
import { DeleteCouponHandler } from './coupons/delete-coupon.handler';
import { GetZatcaConfigHandler } from './zatca-config/get-zatca-config.handler';
import { UpsertZatcaConfigHandler } from './zatca-config/upsert-zatca-config.handler';
import { OnboardZatcaHandler } from './zatca-config/onboard-zatca.handler';
import { GetPaymentStatsHandler } from './get-payment-stats/get-payment-stats.handler';

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
  ListCouponsHandler,
  GetCouponHandler,
  CreateCouponHandler,
  UpdateCouponHandler,
  DeleteCouponHandler,
  GetZatcaConfigHandler,
  UpsertZatcaConfigHandler,
  OnboardZatcaHandler,
  GetPaymentStatsHandler,
];

@Module({
  imports: [DatabaseModule, MessagingModule, StorageModule],
  controllers: [DashboardFinanceController],
  providers: [...handlers, BookingConfirmedHandler],
  exports: [...handlers],
})
export class FinanceModule implements OnModuleInit {
  constructor(private readonly bookingConfirmedHandler: BookingConfirmedHandler) {}

  onModuleInit(): void {
    this.bookingConfirmedHandler.register();
  }
}
