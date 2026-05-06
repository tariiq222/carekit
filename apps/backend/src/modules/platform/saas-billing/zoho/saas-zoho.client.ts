import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ZohoApiClient,
  type ZohoDataCenter,
  type ZohoTenantContext,
  isZohoDataCenter,
} from '../../../../infrastructure/zoho';

/**
 * Wraps {@link ZohoApiClient} with the platform-level credentials read from
 * env vars. Used exclusively by the SaaS billing surface to invoice Deqah
 * tenants for their subscriptions in Deqah's own Zoho organization.
 */
@Injectable()
export class SaasZohoClient {
  private readonly logger = new Logger(SaasZohoClient.name);

  constructor(
    private readonly cfg: ConfigService,
    private readonly api: ZohoApiClient,
  ) {}

  /**
   * Resolves the platform Zoho credentials from env, throwing a clear error
   * when the SaaS-billing Zoho integration has not been configured.
   *
   * `organizationId` here is the tenant's Deqah org id, used purely for
   * scoping the OAuth token cache key inside ZohoApiClient (so different
   * tenants' parallel invoicing operations get isolated cache slots even
   * though the refresh token is shared).
   */
  private context(organizationId: string): ZohoTenantContext {
    const refreshToken = this.cfg.get<string>('ZOHO_PLATFORM_REFRESH_TOKEN');
    const zohoOrganizationId = this.cfg.get<string>('ZOHO_PLATFORM_ORGANIZATION_ID');
    const dcRaw = this.cfg.get<string>('ZOHO_PLATFORM_DC') ?? 'sa';
    if (!refreshToken || !zohoOrganizationId) {
      throw new InternalServerErrorException(
        'SaaS Zoho billing is not configured. Set ZOHO_PLATFORM_REFRESH_TOKEN and ZOHO_PLATFORM_ORGANIZATION_ID.',
      );
    }
    if (!isZohoDataCenter(dcRaw)) {
      throw new InternalServerErrorException(`Invalid ZOHO_PLATFORM_DC: ${dcRaw}`);
    }
    const dataCenter: ZohoDataCenter = dcRaw;
    return { organizationId, zohoOrganizationId, refreshToken, dataCenter };
  }

  isConfigured(): boolean {
    return Boolean(
      this.cfg.get<string>('ZOHO_PLATFORM_REFRESH_TOKEN') &&
        this.cfg.get<string>('ZOHO_PLATFORM_ORGANIZATION_ID'),
    );
  }

  client(organizationId: string): { ctx: ZohoTenantContext; api: ZohoApiClient } {
    return { ctx: this.context(organizationId), api: this.api };
  }
}
