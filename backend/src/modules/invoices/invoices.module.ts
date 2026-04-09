import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';
import { InvoiceCreatorService } from './invoice-creator.service.js';
import { InvoiceStatsService } from './invoice-stats.service.js';
import { ZatcaModule } from '../zatca/zatca.module.js';
import { WhitelabelModule } from '../whitelabel/whitelabel.module.js';
import { ClinicSettingsModule } from '../clinic-settings/clinic-settings.module.js';

@Module({
  imports: [
    ZatcaModule,
    WhitelabelModule,
    ClinicSettingsModule,
    BullModule.registerQueue({ name: 'zatca-submit' }),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceCreatorService, InvoiceStatsService],
  exports: [InvoicesService, InvoiceCreatorService, InvoiceStatsService],
})
export class InvoicesModule {}
