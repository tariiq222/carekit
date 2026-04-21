import { Injectable } from '@nestjs/common';
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
    return this.prisma.organizationSettings.upsert({
      where: { organizationId },
      update: dto,
      create: { organizationId, ...dto },
    });
  }
}
