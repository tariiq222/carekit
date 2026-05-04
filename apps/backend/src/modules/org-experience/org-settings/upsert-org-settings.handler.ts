import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { UpsertOrgSettingsDto } from './upsert-org-settings.dto';

@Injectable()
export class UpsertOrgSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpsertOrgSettingsDto) {
    const organizationId = this.tenant.requireOrganizationId();

    if (dto.vatRate !== undefined) {
      if (!this.tenant.isSuperAdmin()) {
        throw new ForbiddenException('Only super-admin can edit VAT rate');
      }
    }

    return this.prisma.organizationSettings.upsert({
      where: { organizationId },
      update: dto,
      create: { organizationId, ...dto },
    });
  }
}
