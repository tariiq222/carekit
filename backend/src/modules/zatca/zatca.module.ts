import { Module } from '@nestjs/common';
import { ZatcaController } from './zatca.controller.js';
import { ZatcaService } from './zatca.service.js';
import { InvoiceHashService } from './services/invoice-hash.service.js';
import { QrGeneratorService } from './services/qr-generator.service.js';
import { XmlBuilderService } from './services/xml-builder.service.js';
import { ZatcaApiService } from './services/zatca-api.service.js';
import { ZatcaSandboxService } from './services/zatca-sandbox.service.js';

@Module({
  controllers: [ZatcaController],
  providers: [
    ZatcaService,
    InvoiceHashService,
    QrGeneratorService,
    XmlBuilderService,
    ZatcaApiService,
    ZatcaSandboxService,
  ],
  exports: [ZatcaService],
})
export class ZatcaModule {}
