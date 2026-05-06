import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant';
import { ZohoApiClient } from '../../../../infrastructure/zoho';
import { ZohoConfigService } from '../zoho-config.service';
import { SelectOrganizationDto } from '../dto/connect.dto';

/**
 * Used when a tenant has multiple SAR Zoho organizations and we couldn't
 * auto-pick during the OAuth callback. Sets the chosen org_id on the
 * existing (currently inactive) integration row and flips it to active.
 *
 * Validates the selection by calling /organizations again — the user might
 * have revoked the app between consent and selection.
 */
@Injectable()
export class SelectOrganizationHandler {
  constructor(
    private readonly api: ZohoApiClient,
    private readonly config: ZohoConfigService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: SelectOrganizationDto): Promise<{ ok: true; organizationName: string }> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const existing = await this.config.load(organizationId);
    if (!existing.config) {
      throw new BadRequestException('No Zoho connection found — start the Connect flow again.');
    }

    const orgs = await this.api.listOrganizations({
      organizationId,
      refreshToken: existing.config.refreshToken,
      dataCenter: existing.config.dataCenter,
    });
    const match = orgs.organizations.find(
      (o) => o.organization_id === dto.zohoOrganizationId,
    );
    if (!match) {
      throw new BadRequestException(
        'The selected Zoho organization is not accessible by your account.',
      );
    }
    if (match.currency_code !== 'SAR') {
      throw new BadRequestException(
        `The Zoho organization "${match.name}" uses ${match.currency_code}; Deqah currently supports SAR only.`,
      );
    }

    await this.config.save(
      organizationId,
      {
        ...existing.config,
        zohoOrganizationId: match.organization_id,
        zohoOrganizationName: match.name,
      },
      { isActive: true },
    );
    return { ok: true, organizationName: match.name };
  }
}
