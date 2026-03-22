import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { MoyasarPaymentService } from './moyasar-payment.service.js';
import { BankTransferService } from './bank-transfer.service.js';
import { MinioService } from '../../common/services/minio.service.js';
import { InvoicesModule } from '../invoices/invoices.module.js';

@Module({
  imports: [InvoicesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MoyasarPaymentService, BankTransferService, MinioService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
