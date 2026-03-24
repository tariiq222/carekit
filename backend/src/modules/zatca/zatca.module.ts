import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { ZatcaController } from './zatca.controller.js';
import { ZatcaService } from './zatca.service.js';
import { InvoiceHashService } from './services/invoice-hash.service.js';
import { QrGeneratorService } from './services/qr-generator.service.js';
import { XmlBuilderService } from './services/xml-builder.service.js';
import { ZatcaApiService } from './services/zatca-api.service.js';
import { ZatcaSandboxService } from './services/zatca-sandbox.service.js';
import { ZatcaCryptoService } from './services/zatca-crypto.service.js';
import { ZatcaOnboardingService } from './services/zatca-onboarding.service.js';
import { XmlSigningService } from './services/xml-signing.service.js';
import { ZatcaSubmitProcessor } from './services/zatca-submit.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'zatca-submit' }),
    ConfigModule,
  ],
  controllers: [ZatcaController],
  providers: [
    ZatcaService,
    InvoiceHashService,
    QrGeneratorService,
    XmlBuilderService,
    ZatcaApiService,
    ZatcaSandboxService,
    ZatcaCryptoService,
    ZatcaOnboardingService,
    XmlSigningService,
    ZatcaSubmitProcessor,
  ],
  exports: [ZatcaService, XmlSigningService],
})
export class ZatcaModule {}
