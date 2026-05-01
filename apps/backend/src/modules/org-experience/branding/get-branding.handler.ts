import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class GetBrandingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute() {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const row = await this.prisma.brandingConfig.findUnique({
      where: { organizationId },
    });
    if (row) return row;
    return this.prisma.brandingConfig.create({
      data: { organizationId, organizationNameAr: 'منظمتي' },
    });
  }
}
