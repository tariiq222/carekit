import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../../../infrastructure/database';
import { MessagingModule } from '../../../../infrastructure/messaging.module';
import { ZohoInfrastructureModule } from '../../../../infrastructure/zoho/zoho-infrastructure.module';
import { SaasZohoClient } from './saas-zoho.client';
import { InvoiceTenantHandler } from './invoice-tenant.handler';
import { SubscriptionPaidEventHandler } from './subscription-paid.event-handler';

/**
 * SaaS-side Zoho billing — Deqah invoices its tenants for subscription dues.
 *
 * Uses platform-level Zoho credentials from env (ZOHO_PLATFORM_*). When those
 * are unset the module is harmlessly inert: the event subscriber will receive
 * events but `SaasZohoClient.isConfigured()` returns false and the handler
 * exits early.
 */
@Module({
  imports: [DatabaseModule, MessagingModule, ZohoInfrastructureModule],
  providers: [SaasZohoClient, InvoiceTenantHandler, SubscriptionPaidEventHandler],
  exports: [SaasZohoClient, InvoiceTenantHandler],
})
export class SaasZohoModule implements OnModuleInit {
  constructor(private readonly subscriptionPaid: SubscriptionPaidEventHandler) {}

  onModuleInit(): void {
    this.subscriptionPaid.register();
  }
}
