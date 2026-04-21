import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class GetOrgSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute() {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    return this.prisma.organizationSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }
}
