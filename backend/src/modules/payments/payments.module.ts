import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { MinioService } from '../../common/services/minio.service.js';
import { InvoicesModule } from '../invoices/invoices.module.js';

@Module({
  imports: [InvoicesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MinioService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
