import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class GetChatbotConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  /**
   * SaaS-02f: ChatbotConfig is now an org-unique singleton.
   * Upsert-on-read: the first call per org lazily creates the row.
   * Mirrors BrandingConfig (02c).
   */
  async execute() {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    return this.prisma.chatbotConfig.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }
}
