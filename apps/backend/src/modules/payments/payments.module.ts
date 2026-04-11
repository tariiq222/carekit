import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { MoyasarPaymentService } from './moyasar-payment.service.js';
import { MoyasarCheckoutService } from './moyasar-checkout.service.js';
import { MoyasarWebhookService } from './moyasar-webhook.service.js';
import { MoyasarRefundService } from './moyasar-refund.service.js';
import { BankTransferService } from './bank-transfer.service.js';
import { InvoicesModule } from '../invoices/invoices.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { ActivityLogModule } from '../activity-log/activity-log.module.js';
import { GroupsModule } from '../groups/groups.module.js';

@Module({
  imports: [
    InvoicesModule,
    BookingsModule,
    MessagingModule,
    ActivityLogModule,
    GroupsModule,
    BullModule.registerQueue({ name: 'receipt-verification' }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MoyasarCheckoutService,
    MoyasarWebhookService,
    MoyasarRefundService,
    MoyasarPaymentService,
    BankTransferService,
  ],
  exports: [PaymentsService, MoyasarRefundService],
})
export class PaymentsModule {}
