import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';
import { InvoiceCreatorService } from './invoice-creator.service.js';
import { InvoiceStatsService } from './invoice-stats.service.js';
import { ZatcaModule } from '../zatca/zatca.module.js';

@Module({
  imports: [ZatcaModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceCreatorService, InvoiceStatsService],
  exports: [InvoicesService, InvoiceCreatorService, InvoiceStatsService],
})
export class InvoicesModule {}
