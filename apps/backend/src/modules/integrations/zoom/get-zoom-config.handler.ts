import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class GetZoomConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute() {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const integration = await this.prisma.integration.findFirst({
      where: { provider: 'zoom', organizationId },
    });

    if (!integration) {
      return { configured: false, isActive: false };
    }

    return {
      configured: true,
      isActive: integration.isActive,
    };
  }
}
