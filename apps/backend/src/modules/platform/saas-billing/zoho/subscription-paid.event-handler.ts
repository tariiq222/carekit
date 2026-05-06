import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../../../../infrastructure/events';
import { InvoiceTenantHandler } from './invoice-tenant.handler';
import {
  DEFAULT_ORGANIZATION_ID,
  TENANT_CLS_KEY,
} from '../../../../common/tenant/tenant.constants';

interface SubscriptionInvoicePaidPayload {
  subscriptionInvoiceId: string;
  organizationId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  moyasarPaymentId: string;
  paidAt: Date | string;
}

/**
 * Subscribes to `platform.subscription_invoice.paid` and mirrors the
 * paid SubscriptionInvoice into Deqah's platform Zoho organization.
 *
 * The mirror row is stored under `organizationId = DEFAULT_ORGANIZATION_ID`
 * with `scope = 'SAAS_TENANT'` so platform-level reporting can find it
 * without leaking into the billed tenant's tenancy.
 */
@Injectable()
export class SubscriptionPaidEventHandler {
  private readonly logger = new Logger(SubscriptionPaidEventHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly invoiceTenant: InvoiceTenantHandler,
    private readonly cfg: ConfigService,
    private readonly cls: ClsService,
  ) {}

  register(): void {
    this.eventBus.subscribe<SubscriptionInvoicePaidPayload>(
      'platform.subscription_invoice.paid',
      async (envelope) => {
        const platformOrgId =
          this.cfg.get<string>('DEFAULT_ORGANIZATION_ID') ?? DEFAULT_ORGANIZATION_ID;

        await this.cls.run(async () => {
          this.cls.set(TENANT_CLS_KEY, {
            organizationId: platformOrgId,
            membershipId: 'system',
            id: 'system',
            role: 'system',
            isSuperAdmin: false,
          });
          try {
            await this.invoiceTenant.execute({
              subscriptionInvoiceId: envelope.payload.subscriptionInvoiceId,
              organizationId: platformOrgId,
              moyasarPaymentId: envelope.payload.moyasarPaymentId,
              paidAt: new Date(envelope.payload.paidAt),
            });
          } catch (err) {
            this.logger.error(
              `Failed to mirror subscription invoice ${envelope.payload.subscriptionInvoiceId} to Zoho: ${(err as Error).message}`,
            );
            throw err;
          }
        });
      },
    );
  }
}
